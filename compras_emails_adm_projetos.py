"""E-mails administrativos (mailbox Graph) por projeto AEB — Compras / orçamentos.

Fonte: caixas Microsoft 365 (*.adm@, *.tecnicos@, *.gestao@, infraestrutura@).
Chave = nome_fantasia exato em instituicoes.
"""

from __future__ import annotations

# nome_fantasia CareCore → mailbox de envio de cotação do projeto
EMAILS_ADM_COMPRAS_AEB: dict[str, str] = {
    "CA Grants": "ca.grants.adm@aeb-brasil.org.br",
    "CAE F DOWN TOWN": "caef.downtown.adm@aeb-brasil.org.br",
    "CAE F PAULICEIA": "caef.pauliceia.tecnicos@aeb-brasil.org.br",
    "CAE F RIVOLI": "caef.rivoli.tecnicos@aeb-brasil.org.br",
    "CAE F SAMARITANO": "caef.samaritano.adm@aeb-brasil.org.br",
    "CAE F VICTORY": "caef.victory.adm@aeb-brasil.org.br",
    "CAE I CENTRO": "caei.centro.adm@aeb-brasil.org.br",
    "CASA PORTO SEGURO": "casaporto.adm@aeb-brasil.org.br",
    "CDI - ARTE DE VIVER": "cdi.adm@aeb-brasil.org.br",
    "CECOM": "cecom.adm@aeb-brasil.org.br",
    "CEDESP": "cedesp.adm@aeb-brasil.org.br",
    "CEI BELÉM": "cei.belem.adm@aeb-brasil.org.br",
    "CEI LIBERDADE": "cei.liberdade.adm@aeb-brasil.org.br",
    "CEI MONTE AZUL": "cei.jdmonteazul.adm@aeb-brasil.org.br",
    "CEI VILA GUSTAVO": "cei.gustavo.adm@aeb-brasil.org.br",
    "CEI VILA LEOPOLDINA": "cei.leopoldina.adm@aeb-brasil.org.br",
    "CEI VILA NOVA CACHOEIRINHA": "cei.cachoeirinha.adm@aeb-brasil.org.br",
    "CRIAR & TOCAR": "criaretocar.gestao@aeb-brasil.org.br",
    "CTA 17 – LIBERDADE": "cta.liberdade.adm@aeb-brasil.org.br",
    "CTA 18 – CANINDÉ": "cta.caninde.adm@aeb-brasil.org.br",
    "REENCONTRO ANHANGABAÚ": "vila.anhangabau.adm@aeb-brasil.org.br",
    "REENCONTRO CRUZEIRO DO SUL": "vila.cruzeirodosul.adm@aeb-brasil.org.br",
    "REENCONTRO JABAQUARA": "vila.jabaquara1.adm@aeb-brasil.org.br",
    "REENCONTRO PARI": "vila.pari.adm@aeb-brasil.org.br",
    "REPUBLICA RECOMEÇAR": "republica.recomecar.tecnicos@aeb-brasil.org.br",
    "SEDE AEB": "infraestrutura@aeb-brasil.org.br",
    "SIAT II Armênia": "siat2.armenia.adm@aeb-brasil.org.br",
}
