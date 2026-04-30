# API Local v1 (Rascunho Inicial)

Este documento descreve o contrato inicial da API local usada para integracao com extensao de navegador.

## Base URL

- http://127.0.0.1:5474

## Sessao

- `ttl_secs` e o timeout de inatividade da sessao. Padrao: `1800` segundos, 30 minutos.
- `max_ttl_secs` e a vida maxima absoluta da sessao. Padrao: `43200` segundos, 12 horas.
- `expires_at_unix` e renovado a cada chamada autenticada bem-sucedida, limitado por `max_expires_at_unix`.
- Quando `expires_at_unix` ou `max_expires_at_unix` passam, a sessao e removida e a API retorna `401`.
- `POST /api/v1/lock/{session_token}` remove a sessao imediatamente.

## Endpoints

### 1. Health

- Metodo: GET
- Rota: /api/v1/health
- Resposta 200:

```json
{
  "status": "ok",
  "now_unix": 1763382000
}
```

### 2. Unlock de Sessao

- Metodo: POST
- Rota: /api/v1/unlock
- Body:

```json
{
  "master_password": "senha-mestra"
}
```

- Resposta 200:

```json
{
  "session_token": "token-gerado",
  "expires_at_unix": 1763383800,
  "max_expires_at_unix": 1763425200,
  "ttl_secs": 1800,
  "max_ttl_secs": 43200
}
```

- Erros:
- 400: senha nao informada
- 401: senha incorreta/cofre invalido
- 404: cofre nao encontrado

### 3. Renovar Atividade da Sessao

- Metodo: POST
- Rota: /api/v1/session/{session_token}/touch
- Resposta 200:

```json
{
  "expires_at_unix": 1763384700,
  "max_expires_at_unix": 1763425200,
  "ttl_secs": 1800,
  "max_ttl_secs": 43200
}
```

- Uso esperado: manter a sessao ativa quando a UI estiver em uso e obter o novo prazo de inatividade.
- Erros:
- 401: sessao invalida ou expirada

### 4. Status do Cofre

- Metodo: GET
- Rota: /api/v1/vault
- Resposta 200:

```json
{
  "exists": true
}
```

### 5. Criar Cofre

- Metodo: POST
- Rota: /api/v1/vault
- Body:

```json
{
  "master_password": "senha-mestra"
}
```

- Resposta 201:

```json
{
  "session_token": "token-gerado",
  "expires_at_unix": 1763383800,
  "max_expires_at_unix": 1763425200,
  "ttl_secs": 1800,
  "max_ttl_secs": 43200
}
```

- Erros:
- 400: senha mestra invalida
- 409: cofre ja existe

### 6. Listagem de Entradas

- Metodo: GET
- Rota: /api/v1/entries/{session_token}
- Resposta 200:

```json
{
  "entries": [
    {
      "id": "8ad74fca-97fc-4cff-a0d7-a381f7189b29",
      "servico": "github",
      "usuario": "joao",
      "url": "https://github.com/login",
      "atualizado_em": "1763381900"
    }
  ]
}
```

- Erros:
- 401: sessao invalida ou expirada

Observacao: chamada autenticada bem-sucedida renova `expires_at_unix`, mas esta resposta nao retorna o novo prazo. Use `/api/v1/session/{session_token}/touch` quando a UI precisar sincronizar o contador.

### 7. Cadastrar Chave

- Metodo: POST
- Rota: /api/v1/entries/{session_token}
- Body:

```json
{
  "servico": "github",
  "usuario": "joao",
  "senha": "segredo",
  "url": "https://github.com/login",
  "notas": "opcional"
}
```

- Resposta 201:

```json
{
  "entry_id": "8ad74fca-97fc-4cff-a0d7-a381f7189b29",
  "created": true
}
```

- Resposta 200: quando atualiza uma chave existente com o mesmo servico.

- Erros:
- 400: servico, usuario ou senha ausentes
- 401: sessao invalida ou expirada

### 8. Editar Chave por ID

- Metodo: PUT
- Rota: /api/v1/entries/{session_token}/{entry_id}
- Body (todos os campos sao opcionais):

```json
{
  "servico": "github",
  "usuario": "novo-usuario",
  "senha": "nova-senha",
  "url": "https://github.com/novo-login",
  "notas": "notas atualizadas"
}
```

- Resposta 200:

```json
{
  "entry_id": "8ad74fca-97fc-4cff-a0d7-a381f7189b29",
  "created": false
}
```

- Erros:
- 401: sessao invalida ou expirada
- 404: entrada nao encontrada

### 9. Excluir Chave

- Metodo: DELETE
- Rota: /api/v1/entries/{session_token}/{entry_id}
- Resposta 204 sem body

- Erros:
- 401: sessao invalida ou expirada
- 404: entrada nao encontrada

### 10. Obter Senha por ID

- Metodo: GET
- Rota: /api/v1/entries/{session_token}/{entry_id}/password
- Resposta 200:

```json
{
  "senha": "segredo"
}
```

- Erros:
- 401: sessao invalida ou expirada
- 404: entrada nao encontrada

### 11. Obter Notas por ID

- Metodo: GET
- Rota: /api/v1/entries/{session_token}/{entry_id}/notes
- Resposta 200:

```json
{
  "notas": "texto opcional"
}
```

- Se a entrada nao tiver notas, retorna `"notas": null`.

- Erros:
- 401: sessao invalida ou expirada
- 404: entrada nao encontrada

### 12. Lock da Sessao

- Metodo: POST
- Rota: /api/v1/lock/{session_token}
- Resposta 204 sem body

- Erros:
- 404: sessao nao encontrada

## Estado atual de seguranca

- Implementado: sessao com timeout de inatividade configuravel, vida maxima absoluta, renovacao em atividade autenticada e invalidacao manual.
- Pendente: autenticacao por header (Bearer), assinatura de request e whitelist de origem.
- Pendente: rate limit e auditoria local de acesso.

## Roadmap imediato da API

1. Migrar token de rota para header Authorization: Bearer.
2. Padronizar codigos de erro e schema de resposta de falha.
3. Adicionar testes de integracao dos fluxos principais.
