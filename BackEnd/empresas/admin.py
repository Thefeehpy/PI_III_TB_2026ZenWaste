from django import forms
from django.contrib import admin
from app.excecoes import ErroRegraNegocio
from empresas.models import Empresa, EmpresaPapel, PapelEmpresa
from empresas.servicos import (
    PAPEIS_PADRAO_EMPRESA,
    atribuir_papeis_empresa,
    desativar_empresa,
    validar_email_empresa,
)


class FormularioAdministrativoEmpresa(forms.ModelForm):
    nova_senha = forms.CharField(
        label="Nova senha",
        min_length=6,
        required=False,
        widget=forms.PasswordInput(render_value=False),
        help_text="Obrigatoria no cadastro; deixe vazia para manter a senha existente.",
    )

    class Meta:
        model = Empresa
        fields = "__all__"

    def clean(self):
        dados_limpos = super().clean()
        if self.instance._state.adding and not dados_limpos.get("nova_senha"):
            self.add_error("nova_senha", "Informe uma senha para cadastrar a empresa.")
        return dados_limpos

    def clean_email(self):
        try:
            return validar_email_empresa(self.cleaned_data["email"], empresa_atual=self.instance)
        except ErroRegraNegocio as erro:
            raise forms.ValidationError(erro.detalhes["email"]) from erro


class EdicaoPapeisEmpresa(admin.TabularInline):
    model = EmpresaPapel
    extra = 0

class AdministracaoEmpresa(admin.ModelAdmin):
    form = FormularioAdministrativoEmpresa
    list_display = ("id_empresa", "razao_social", "cnpj", "email", "ativo")
    search_fields = ("razao_social", "cnpj", "email")
    list_filter = ("ativo", "papeis")
    exclude = ("senha",)
    inlines = [EdicaoPapeisEmpresa]
    actions = ["desativar_empresas"]

    def save_model(self, requisicao, objeto, formulario, alteracao):
        if formulario.cleaned_data.get("nova_senha"):
            objeto.definir_senha(formulario.cleaned_data["nova_senha"])
        super().save_model(requisicao, objeto, formulario, alteracao)

    def save_related(self, requisicao, formulario, conjuntos_formularios, alteracao):
        super().save_related(requisicao, formulario, conjuntos_formularios, alteracao)
        if not formulario.instance.papeis.exists():
            atribuir_papeis_empresa(formulario.instance, PAPEIS_PADRAO_EMPRESA)

    @admin.action(description="Desativar empresas selecionadas")
    def desativar_empresas(self, requisicao, consulta):
        for empresa in consulta:
            desativar_empresa(empresa)

    def has_delete_permission(self, requisicao, objeto=None):
        return False

admin.site.register(Empresa, AdministracaoEmpresa)
admin.site.register(PapelEmpresa)
