from django import forms
from .models import Empresa
from django.core.exceptions import ValidationError

class FormularioCadastroEmpresa(forms.ModelForm):
    # Nomes dos campos mantidos pelo contrato do formulario legado.
    username = forms.CharField(max_length=150, label="Nome de Usuário")
    password = forms.CharField(widget=forms.PasswordInput, label="Senha")
    password_confirm = forms.CharField(widget=forms.PasswordInput, label="Confirme a Senha")

    class Meta:
        model = Empresa  
        fields = '__all__' 
  
    def clean(self):
        dados_limpos = super().clean()
        senha = dados_limpos.get("password")
        confirmacao_senha = dados_limpos.get("password_confirm")

        if senha != confirmacao_senha:
            raise ValidationError("As senhas não coincidem.")
        return dados_limpos
