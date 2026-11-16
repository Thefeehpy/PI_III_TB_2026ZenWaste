"""Auxiliar de teste: interrompe um subprocesso após transporte falso, nunca no banco principal."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys


def executar(despacho_id,empresa_id,operador_id):
    from django.conf import settings
    from django.db import connection
    db=connection.settings_dict
    esperado=getattr(settings,'MTR_ISOLADO_ESPERADO',None)
    if not isinstance(esperado,dict) or esperado.get('perfil')!='MTR_ISOLADO' or not db['NAME'].startswith('test_zenwaste_') or db['HOST']!='127.0.0.1' or str(db['PORT'])!=str(esperado.get('port')):
        raise RuntimeError('Subprocesso permitido somente no PostgreSQL de teste isolado.')
    with connection.cursor() as cursor:
        cursor.execute("SELECT current_setting('data_directory'),(pg_control_system()).system_identifier::text")
        diretorio,sistema=cursor.fetchone()
    if sistema!=esperado['system_id']:raise RuntimeError('Cluster de teste divergente.')
    cfg={'db':{k:db[k] for k in ['ENGINE','NAME','USER','PASSWORD','HOST','PORT']},
         'apps':list(settings.INSTALLED_APPS),'user_model':settings.AUTH_USER_MODEL,
         'diretorio':diretorio,'sistema':sistema}
    ambiente=os.environ.copy()
    # Configuração efêmera somente no ambiente do filho; nunca em argv, arquivos ou logs.
    ambiente['ZENWASTE_TESTE_PROCESSO']=json.dumps(cfg)
    return subprocess.run([sys.executable,'-m','mtr.testes.processo_interrompido',str(despacho_id),str(empresa_id),str(operador_id)],
        cwd=Path(__file__).resolve().parents[2],env=ambiente,capture_output=True,timeout=30,
        creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))


def _filho():
    cfg=json.loads(os.environ.pop('ZENWASTE_TESTE_PROCESSO'))
    db=cfg['db']
    if not db['NAME'].startswith('test_zenwaste_') or db['HOST']!='127.0.0.1':raise RuntimeError('Banco não autorizado.')
    import psycopg2
    original=psycopg2.connect
    def conectar(*args,**kw):
        if args or any(str(kw.get(k,''))!=str(db[v]) for k,v in [('dbname','NAME'),('host','HOST'),('port','PORT'),('user','USER'),('password','PASSWORD')]):
            raise RuntimeError('Conexão fora do banco de teste.')
        conn=original(**kw)
        try:
            conn.autocommit=True
            with conn.cursor() as cursor:
                cursor.execute("SELECT current_database(),current_setting('data_directory'),(pg_control_system()).system_identifier::text")
                nome,diretorio,sistema=cursor.fetchone()
            if nome!=db['NAME'] or diretorio!=cfg['diretorio'] or sistema!=cfg['sistema']:raise RuntimeError('Instância divergente.')
            conn.autocommit=False
            return conn
        except Exception:conn.close();raise
    psycopg2.connect=conectar
    def sem_rede(*args,**kw):raise RuntimeError('Rede de teste bloqueada.')
    socket.socket.connect=sem_rede
    from django.conf import settings
    settings.configure(SECRET_KEY='CHAVE-FICTICIA-EXCLUSIVA-TESTE-DE-PROCESSO',INSTALLED_APPS=cfg['apps'],
        AUTH_USER_MODEL=cfg['user_model'],DATABASES={'default':db},USE_TZ=True,
        TIME_ZONE='America/Sao_Paulo',DEFAULT_AUTO_FIELD='django.db.models.BigAutoField',MTR_PROVEDOR='MOCK')
    import django
    django.setup()
    from empresas.models import Empresa
    from mtr.models import OperadorMTR
    from mtr.sigor.despacho import despachar_simulado
    from mtr.sigor.simulacao import TransporteDespachoSimulado
    from uuid import uuid4
    class Interrompe(TransporteDespachoSimulado):
        def enviar(self,wire):
            super().enviar(wire)
            os._exit(73)
    despachar_simulado(Empresa.objects.get(pk=sys.argv[2]),sys.argv[1],
        OperadorMTR.objects.select_related('usuario').get(pk=sys.argv[3]),uuid4(),transporte=Interrompe())


if __name__=='__main__':_filho()
