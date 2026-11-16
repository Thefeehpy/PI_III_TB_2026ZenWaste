from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [('mtr', '0004_mtr_operacional')]
    operations = [migrations.RunSQL(
        """CREATE OR REPLACE FUNCTION mtr05_rascunho_congelado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.frete_id IS NULL AND OLD.estado<>'RASCUNHO' THEN
  IF TG_OP='DELETE' OR NEW.estado='RASCUNHO' OR ROW(OLD.empresa_id,OLD.frete_id,OLD.ambiente,OLD.dados,OLD.contexto) IS DISTINCT FROM ROW(NEW.empresa_id,NEW.frete_id,NEW.ambiente,NEW.dados,NEW.contexto) THEN RAISE EXCEPTION 'RASCUNHO_MTR05_CONGELADO'; END IF;
 END IF;
 RETURN NEW;
END $$;""",
        """CREATE OR REPLACE FUNCTION mtr05_rascunho_congelado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.frete_id IS NULL AND OLD.estado<>'RASCUNHO' THEN
  IF TG_OP='DELETE' OR ROW(OLD.empresa_id,OLD.frete_id,OLD.ambiente,OLD.dados,OLD.contexto) IS DISTINCT FROM ROW(NEW.empresa_id,NEW.frete_id,NEW.ambiente,NEW.dados,NEW.contexto) THEN RAISE EXCEPTION 'RASCUNHO_MTR05_CONGELADO'; END IF;
 END IF;
 RETURN NEW;
END $$;""",
    )]
