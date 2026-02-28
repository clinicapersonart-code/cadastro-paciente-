export interface AnamneseTopic {
    id: string;
    title: string;
    description: string;
}

export interface AnamneseTemplate {
    id: string;
    name: string;
    description: string;
    topics: AnamneseTopic[];
}

export const ANAMNESE_TEMPLATES: AnamneseTemplate[] = [
    {
        id: 'modelo-1',
        name: 'Modelo 1 - Anamnese Completa',
        description: 'Roteiro de anamnese biopsicossocial completa com 12 tópicos fundamentais.',
        topics: [
            {
                id: 'queixa_principal',
                title: 'Motivo da consulta / queixa principal',
                description: 'Razão que levou o paciente a buscar terapia; sintomas, pensamentos, comportamentos e situações descritas, com duração, frequência, intensidade e impacto funcional.'
            },
            {
                id: 'historia_doenca_atual',
                title: 'História da doença atual',
                description: 'Linha do tempo da queixa: início, fatores precipitantes, evolução, tratamentos ou estratégias já tentados e respectivas respostas.'
            },
            {
                id: 'historia_psiquiatrica_passada',
                title: 'História psiquiátrica passada',
                description: 'Episódios anteriores de depressão, ansiedade, mania, psicose, tentativas de suicídio, internações, tratamentos e medicações utilizadas.'
            },
            {
                id: 'historia_medica',
                title: 'História médica e medicamentosa',
                description: 'Doenças crônicas, cirurgias, alergias, deficiências, resultados de exames relevantes, uso atual de medicamentos (dose, adesão, efeitos colaterais).'
            },
            {
                id: 'historia_familiar',
                title: 'História familiar',
                description: 'Membros da família, transtornos psiquiátricos, doenças médicas relevantes, história de suicídio ou abuso de substâncias em parentes de primeiro grau.'
            },
            {
                id: 'historia_psicossocial',
                title: 'História psicossocial e de desenvolvimento',
                description: 'Marcos do desenvolvimento infantil, desempenho escolar, eventos traumáticos ou significativos, dinâmica familiar, histórico de abuso/negligência, processos judiciais.'
            },
            {
                id: 'relacoes_interpessoais',
                title: 'Relações interpessoais',
                description: 'Rede de apoio: familiares, amigos, parceiros; qualidade dos vínculos, fontes de conflito, presença de violência doméstica.'
            },
            {
                id: 'habitos_vida',
                title: 'Hábitos de vida e funcionamento atual',
                description: 'Rotina diária (trabalho/estudo, lazer, hobbies), sono, alimentação, atividade física, consumo de álcool, tabaco e outras substâncias; o que faz e o que gostaria de fazer.'
            },
            {
                id: 'avaliacao_risco',
                title: 'Avaliação de risco',
                description: 'Ideação ou plano suicida/homicida, tentativas anteriores, acesso a meios letais, auto‑agressão, risco a terceiros, fatores protetores e estressores atuais.'
            },
            {
                id: 'recursos_forcas',
                title: 'Recursos, forças e fatores protetores',
                description: 'Habilidades, crenças, valores, apoio social, realizações e quaisquer aspectos que reforcem resiliência.'
            },
            {
                id: 'expectativas_metas',
                title: 'Expectativas e metas com o tratamento',
                description: 'Objetivos de curto, médio e longo prazo; critérios pessoais de sucesso; prontidão para mudança e possíveis barreiras (tempo, custos, crenças).'
            },
            {
                id: 'exame_estado_mental',
                title: 'Exame do estado mental',
                description: 'Observação sistemática de aparência, comportamento, humor/afeto, pensamento, percepção, cognição, insight e julgamento no momento da entrevista.'
            }
        ]
    }
];
