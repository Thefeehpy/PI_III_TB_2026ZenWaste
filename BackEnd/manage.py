#!/usr/bin/env python
"""Executa os comandos administrativos do Django."""
import os
import sys


def executar_gerenciamento():
    """Inicializa as configurações e executa o comando solicitado."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as erro:
        raise ImportError(
            "Nao foi possivel importar Django. Confira a instalacao das "
            "dependencias e a ativacao do ambiente virtual."
        ) from erro
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    executar_gerenciamento()
