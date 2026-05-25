from django import forms
from .models import Empresa
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError

class CadastroEmpresaForm(forms.ModelForm):
    # Campos extras para a criação do Usuário
    username = forms.CharField(max_length=150, label="Nome de Usuário")
    password = forms.CharField(widget=forms.PasswordInput, label="Senha")
    password_confirm = forms.CharField(widget=forms.PasswordInput, label="Confirme a Senha")

    class Meta:
        model = Empresa  
        fields = '__all__' 
  
    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        password_confirm = cleaned_data.get("password_confirm")

        if password != password_confirm:
            raise ValidationError("As senhas não coincidem.")
        return cleaned_data