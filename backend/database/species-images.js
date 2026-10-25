// Fotos do catálogo de espécies: o peixe que aparece na foto (nome
// científico), arquivo em backend/assets/species/, autor, licença, link da
// origem, legenda (quando a foto mostra uma espécie diferente da entrada, nas
// de gênero) e o que foi alterado (CC BY exige indicar).
//
// Fotos da equipe ("Equipe Tamba"): todos os direitos reservados, NÃO são CC.
// Os originais (pasta peixes/, fora do git) tinham pessoas e podiam ter GPS de
// pesqueiro (RGN-13): aqui só entra o recorte no peixe, regravado sem metadado.
//
// Fotos cedidas por pescadores (USO_AUTORIZADO): o autor deu permissão por
// escrito para o Tamba usar a foto; a permissão fica guardada fora do
// repositório. Também NÃO são CC: valem para o app, não para quem reaproveitar
// o repositório. Mesmo tratamento das fotos da equipe (recorte no peixe, sem
// rosto, sem metadado), e a licença é sempre a constante, nunca outra frase.
//
// Lido pelo seed (fish_species.image_*) e pelo `npm run credits`, que gera o
// CREDITOS.md da raiz.
//
// Como as fotos foram escolhidas:
//   - pela categoria do Wikimedia Commons com o NOME CIENTÍFICO exato (ou por
//     observação "research grade" do iNaturalist, quando o Commons não tinha
//     foto boa), nunca pelo nome popular, que muda de região para região;
//   - descrição do arquivo conferida contra o nome científico;
//   - licença: domínio público ou CC0 primeiro, depois CC BY. Nenhuma CC BY-SA
//     e nenhum desenho: só fotografia;
//   - espécies de gênero ("spp.") usam a foto de uma espécie do gênero.
//
// As espécies sem foto (a Dex mostra o 🐟) e o porquê estão em
// speciesWithoutImage, no fim do arquivo.
//
// Trocar uma foto: substitua o arquivo, atualize a entrada e rode
// `npm run thumbs` e `npm run credits`. O seed só preenche coluna vazia (ver
// seed.js): num banco que já tem a foto antiga, a troca se faz pelo
// formulário de espécie. Dar foto a uma espécie que não tinha: acrescente a
// entrada e tire a espécie de speciesWithoutImage (o `npm run credits`
// recusa as duas coisas ao mesmo tempo).

// A licença das fotos cedidas por pescadores. Uma frase só, para a tela
// /creditos não acumular variações da mesma coisa; a mesma está nas sugestões
// do formulário de espécie (frontend, SpeciesForm.tsx).
export const USO_AUTORIZADO = "Uso autorizado pelo autor";

export const speciesImages = {
  "Tambaqui": {
    pictured: "Colossoma macropomum",
    file: "tambaqui.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (sem pessoas no quadro); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Tambacu": {
    pictured: "Tambacu (híbrido Colossoma macropomum × Piaractus mesopotamicus), identificado pela equipe",
    file: "tambacu.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (sem pessoas no quadro); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Cachapira": {
    pictured: "Cachapira (híbrido Pseudoplatystoma reticulatum × Phractocephalus hemioliopterus), identificado pelo pescador",
    file: "cachapira.webp",
    credit: "Ricardo o Pavarotti da UL",
    license: USO_AUTORIZADO,
    sourceUrl: "https://www.instagram.com/pavarotti_da_ul/",
    changes: "recortada no peixe (sem o rosto de quem segura; ficam as mãos e parte da camisa); metadados removidos; fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Pacu": {
    pictured: "Piaractus mesopotamicus",
    file: "pacu.webp",
    credit: "Renata Rúbia Ota et al.",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Peixes_da_plan%C3%ADcie_de_inunda%C3%A7%C3%A3o_do_alto_rio_Paran%C3%A1_(3678425)_(cropped).png",
    changes: "redimensionada e convertida para WebP; letra do painel da figura removida",
  },
  "Piracanjuba": {
    pictured: "Brycon orbignyanus",
    file: "piracanjuba.webp",
    credit: "W.S.Serra",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Brycon_orbignyanus.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Matrinxã": {
    pictured: "Brycon amazonicus",
    file: "matrinxa.webp",
    credit: "Vincent A. Vos",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Brycon_amazonicus_118574803.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Dourado": {
    pictured: "Salminus brasiliensis",
    file: "dourado.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (sem pessoas no quadro); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Pirarara": {
    pictured: "Phractocephalus hemioliopterus",
    file: "pirarara.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (sem pessoas no quadro); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Pintado": {
    pictured: "Pseudoplatystoma corruscans",
    file: "pintado.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (sem pessoas no quadro); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Surubim": {
    pictured: "Pseudoplatystoma tigrinum (acima) e Pseudoplatystoma punctifer (abaixo)",
    file: "surubim.webp",
    credit: "Whaldener Endo",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pseudoplaystoma_duo.jpg",
    caption: "Na foto: duas espécies amazônicas do gênero, Pseudoplatystoma tigrinum (acima) e P. punctifer (abaixo).",
    changes: "redimensionada e convertida para WebP",
  },
  "Cachara": {
    pictured: "Pseudoplatystoma reticulatum",
    file: "cachara.webp",
    credit: "Pablo Scarabotti et al.",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pseudoplatystoma_duo_duo.png",
    changes: "redimensionada e convertida para WebP; recortada (só o peixe de baixo da figura); fundo estendido para a proporção 3:2",
  },
  "Piraíba": {
    pictured: "Brachyplatystoma filamentosum",
    file: "piraiba.webp",
    credit: "タウナギ",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Brachyplatystoma_filamentosum_Totto.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Jundiá": {
    pictured: "Rhamdia quelen",
    file: "jundia.webp",
    credit: "Ictiologia Universidad Católica de Oriente",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Rhamdia_quelen_(16335507449).jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Mandi (Mandi-amarelo)": {
    pictured: "Pimelodus maculatus",
    file: "mandi.webp",
    credit: "Luis Capeletti",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Pimelodus_maculatus_328619969.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Catfish": {
    pictured: "Ictalurus punctatus",
    file: "catfish.webp",
    credit: "Sam Stukel (USFWS)",
    license: "Domínio público",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Channel_Catfish_(Ictalurus_punctatus)_(53025368170).jpg",
    changes: "redimensionada e convertida para WebP; fundo estendido para a proporção 3:2",
  },
  "Pirarucu": {
    pictured: "Arapaima gigas",
    file: "pirarucu.webp",
    credit: "Cliff",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Arapaima_(Arapaima_gigas)_2.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Tucunaré": {
    pictured: "Cichla piquiti",
    file: "tucunare.webp",
    credit: "André Ambrozio",
    license: "CC BY 4.0",
    sourceUrl: "https://www.inaturalist.org/observations/223062807",
    caption: "Na foto: Cichla piquiti (tucunaré-azul), uma das espécies do gênero estocadas em São Paulo; a outra comum é C. kelberi.",
    changes: "fundo completado até 3:2 com o próprio recorte desfocado; redimensionada e convertida para WebP",
  },
  "Bagre-africano": {
    pictured: "Clarias gariepinus (forma albina, a comum em pesqueiro)",
    file: "bagre-africano.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (ficam as mãos de quem segura e parte do braço); texto impresso no saco plástico (telefone e site) borrado; metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Traíra": {
    pictured: "Hoplias malabaricus",
    file: "traira.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe (sem pessoas no quadro; fica a ponta de um alicate de pesca); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Black Bass": {
    pictured: "Micropterus salmoides",
    file: "black-bass.webp",
    credit: "Equipe Tamba",
    license: "Todos os direitos reservados",
    sourceUrl: null,
    changes: "recortada no peixe e girada 90° (sem pessoas no quadro); metadados removidos (sem GPS); fundo completado até 3:2 com o próprio recorte desfocado; convertida para WebP",
  },
  "Jacundá": {
    pictured: "Crenicichla lacustris",
    file: "jacunda.webp",
    credit: "Pablo Cauã da Silva Toledo",
    license: "CC BY 4.0",
    sourceUrl: "https://www.inaturalist.org/observations/206001980",
    caption: "Na foto: Crenicichla lacustris (nome aceito). Parte dos peixes chamados de jacundá foi transferida para o gênero Saxatilia em 2023 (ex.: Crenicichla lepidota = Saxatilia lepidota); C. lacustris continua em Crenicichla.",
    changes: "redimensionada e convertida para WebP",
  },
  "Cará (Acará)": {
    pictured: "Geophagus brasiliensis",
    file: "cara.webp",
    credit: "Cezary Porycki",
    license: "CC BY 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Geophagus_brasiliensis_c01.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Tilápia": {
    pictured: "Oreochromis niloticus",
    file: "tilapia.webp",
    credit: "Magdy A. Saleh",
    license: "CC BY 3.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Oreochromis_niloticus_Egypt.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Piau": {
    pictured: "Leporinus friderici",
    file: "piau.webp",
    credit: "Gerry van Tonder",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Leporinus_friderici_60892985.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Curimbatá": {
    pictured: "Prochilodus lineatus",
    file: "curimbata.webp",
    credit: "dariocrosa",
    license: "CC0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Prochilodus_lineatus_351939209_(cropped).jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Lambari": {
    pictured: "Astyanax lacustris",
    file: "lambari.webp",
    credit: "Douglas Lopes",
    license: "CC BY 4.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Astyanax_lacustris_326506492.jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Carpa Cabeçuda": {
    pictured: "Hypophthalmichthys nobilis",
    file: "carpa-cabecuda.webp",
    credit: "Invasive Carp Regional Coordinating Committee",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Bighead_carp_(March_2012).jpg",
    changes: "redimensionada e convertida para WebP",
  },
  "Carpa Húngara": {
    pictured: "Cyprinus carpio",
    file: "carpa-hungara.webp",
    credit: "Sam Stukel (USFWS)",
    license: "Domínio público",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Common_Carp_(Cyprinus_carpio)_(2)_(51222524751)_(cropped).jpg",
    changes: "redimensionada e convertida para WebP; fundo estendido para a proporção 3:2",
  },
  "Carpa Capim": {
    pictured: "Ctenopharyngodon idella",
    file: "carpa-capim.webp",
    credit: "Sam Stukel (USFWS)",
    license: "Domínio público",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Grass_Carp_(Ctenopharyngodon_idella)_(52209715989).jpg",
    changes: "redimensionada e convertida para WebP; fundo estendido para a proporção 3:2",
  },
  "Carpa Espelho": {
    pictured: "Cyprinus carpio (variedade espelho)",
    file: "carpa-espelho.webp",
    credit: "U.S. Fish and Wildlife Service (USFWS)",
    license: "Domínio público",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:%22Mirror_Carp%22_(Cyprinus_carpio)_(cropped).jpg",
    changes: "redimensionada e convertida para WebP; fundo estendido para a proporção 3:2",
  },
  "Carpa Colorida": {
    pictured: "Cyprinus carpio (koi)",
    file: "carpa-colorida.webp",
    credit: "R'lyeh Imaging",
    license: "CC BY 2.0",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:2018-04-21_Koi.jpg",
    changes: "redimensionada e convertida para WebP",
  },
};

// Espécies do catálogo sem foto, de propósito, e o porquê (vai para o
// CREDITOS.md). A LISTA não sai daqui: o `npm run credits` a calcula pelo
// catálogo menos speciesImages, a mesma regra da tela /creditos (sem
// image_url). Daqui sai só o motivo, e o credits recusa motivo de espécie que
// já tem foto ou espécie sem foto e sem motivo.
const HIBRIDO_SEM_FOTO =
  "híbrido de piscicultura. Não há foto confiável, e usar a foto de uma das espécies que o originam, como se fosse o híbrido, estaria errado.";

export const speciesWithoutImage = {
  "Patinga": HIBRIDO_SEM_FOTO,
  "Pincachara": HIBRIDO_SEM_FOTO,
  "Piauçu": "nenhuma foto livre em que a espécie esteja identificada de forma confiável.",
  "Trairão":
    "o nome cobre um grupo de espécies quase idênticas, e as populações do Sul e do Uruguai costumam ser atribuídas a outras espécies do grupo. Não há registro brasileiro sólido com licença livre: os dois disponíveis são uma foto turva do Rio Grande do Sul e uma pilha de peixes. Melhor sem foto do que com uma identificação duvidosa.",
};
