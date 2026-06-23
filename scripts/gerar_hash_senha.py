"""Script para gerar hash SHA-256 de senha (uso em secrets.toml)."""
import hashlib
import getpass

senha = getpass.getpass("Digite a senha: ")
print(f"\nHash SHA-256:\n{hashlib.sha256(senha.encode()).hexdigest()}")
