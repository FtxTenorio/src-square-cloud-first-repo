# Nginx – porta 80 para o frontend

O Nginx fica **instalado no sistema** (não é dependência do projeto). Este diretório guarda a **configuração** que o Nginx usa.

## 1. Instalar o Nginx

### Linux / WSL (Debian/Ubuntu)

```bash
sudo apt update
sudo apt install nginx
```

### Outros

- **Fedora:** `sudo dnf install nginx`
- **macOS:** `brew install nginx`
- **Windows (sem WSL):** baixe em [nginx.org](https://nginx.org/en/download.html) ou use WSL.

---

## 2. Usar a config deste projeto

A config está em `nginx/square-cloud.conf`. Ela faz:

- **Porta 80** → proxy para o Next.js em **http://127.0.0.1:3000**

### Opção A: Symlink (recomendado)

```bash
# Crie o link no diretório de sites ativos do nginx
sudo ln -sf "$(pwd)/nginx/square-cloud.conf" /etc/nginx/sites-enabled/square-cloud.conf

# Remova o default se existir (evita conflito na porta 80)
sudo rm -f /etc/nginx/sites-enabled/default

# Teste a config
sudo nginx -t

# Recarregue o nginx
sudo systemctl reload nginx
```

Execute os comandos a partir da **raiz do repositório** (onde está a pasta `nginx/`).  
Se estiver em outro diretório, use o caminho absoluto no lugar de `$(pwd)`.

### Opção B: Copiar o arquivo

```bash
sudo cp nginx/square-cloud.conf /etc/nginx/sites-available/square-cloud.conf
sudo ln -sf /etc/nginx/sites-available/square-cloud.conf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

## 3. Subir o frontend

Antes de acessar a porta 80, o Next precisa estar rodando na 3000:

```bash
# Na raiz do repo (ou onde estiver o client)
pnpm client:dev
# ou: cd src/client && pnpm dev
```

Depois acesse **http://localhost** (porta 80). O Nginx encaminha para o app na 3000.

---

## 4. Comandos úteis do Nginx

| Comando | Descrição |
|--------|-----------|
| `sudo nginx -t` | Testa a configuração |
| `sudo systemctl start nginx` | Inicia o Nginx |
| `sudo systemctl stop nginx` | Para o Nginx |
| `sudo systemctl reload nginx` | Recarrega a config sem derrubar conexões |
| `sudo systemctl status nginx` | Mostra status do serviço |

---

## Resumo

1. Instale o Nginx no sistema (`apt install nginx` ou equivalente).  
2. Ative a config deste projeto (symlink ou cópia em `sites-enabled`).  
3. Deixe o Next rodando na porta 3000 (`pnpm client:dev`).  
4. Acesse **http://localhost** (porta 80); o Nginx faz o proxy para o frontend.
