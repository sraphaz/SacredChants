# Conduta compartilhada — todos os agentes ARAH

- Escopo mínimo: tocar apenas paths permitidos no manifest.
- Sem merge automático em `main` / produção.
- PR obrigatório para alterações de produto.
- Spec-before-code quando a fase exigir `Spec-Id:`.
- Documentação atualizada no mesmo PR quando código mudar comportamento observável.
- Comunicação entre agentes é passiva (arquivo + CI), sem turnos extras de modelo.
- Secrets nunca no diff; falhar cedo se detectado.
