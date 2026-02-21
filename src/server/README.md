## 🤖 Como Interagir com o Bot

### 💬 **Conversa Natural**
O bot responde quando você:
- **Menciona ele** (`@BotName olá!`)
- **Envia DM** direta

**Palavras-chave que ele entende:**
| Palavra | Resposta |
|---------|----------|
| `olá`, `oi`, `eae`, `fala`, `salve` | Saudação |
| `tchau`, `até`, `flw`, `vlw` | Despedida |
| `obrigado`, `valeu`, `thanks` | Agradecimento |
| `como você está`, `tudo bem` | Pergunta sobre estado |
| `ajuda`, `help` | Lista de comandos |
| `quem é você`, `seu nome` | Identidade do bot |

---

### 🎭 **Personalidades** (`/personality`)
Escolha como o bot conversa com você:
- 😊 **Amigável** - Caloroso e acolhedor
- 💼 **Profissional** - Formal e objetivo
- 🤣 **Engraçado** - Humor e piadas
- 🧙‍♂️ **Sábio** - Provérbios e reflexões
- 🏴‍☠️ **Pirata** - "Arrr marujo!"

---

### 🎮 **Slash Commands**

**Diversão:**
- `/8ball [pergunta]` - Bola mágica
- `/roll [dados]` - Rola dados (ex: `2d6`, `1d20+5`)
- `/joke` - Piada de programador
- `/meme` - Meme aleatório
- `/rps [escolha]` - Pedra, papel, tesoura
- `/compliment [@user]` - Elogia alguém
- `/roast [@user]` - Zoeira leve
- `/choose [opções]` - Escolhe entre opções
- `/rate [coisa]` - Avalia de 0-10
- `/ship [@user1] [@user2]` - Teste de compatibilidade

**Utilidades:**
- `/weather [cidade]` - Previsão do tempo
- `/translate [texto]` - Traduz texto
- `/poll [pergunta]` - Cria votação
- `/remind [tempo] [msg]` - Lembrete (ex: `10m`, `1h`)
- `/calc [expressão]` - Calculadora
- `/coin` - Joga moeda

**Níveis/XP:**
- `/level` - Seu nível atual
- `/stats` - Estatísticas completas
- `/leaderboard` - Ranking do servidor
- `/badges` - Badges disponíveis

**Moderação (Admins):**
- `/kick`, `/ban`, `/timeout`, `/warn`
- `/warnings [@user]` - Lista avisos
- `/clear [quantidade]` - Limpa mensagens
- `/modlogs` - Logs de moderação

---

### 📈 **Sistema de XP**
- Ganhe **10-25 XP** por mensagem (cooldown 1 min)
- Suba de nível automaticamente
- Desbloqueie **badges** por conquistas
- Mantenha **streak** de dias ativos

---

### 🚀 **Deploy dos Comandos**
Para ativar os slash commands no Discord:
```bash
node scripts/deploy-commands.js
```

⚠️ Certifique-se de ter no .env:
```
DISCORD_CLIENT_ID=seu_client_id
```