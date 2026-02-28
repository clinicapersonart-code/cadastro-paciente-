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
    },
    {
        id: 'modelo-infantil',
        name: 'Modelo 2 - Anamnese (Criança e Adolescente)',
        description: 'Roteiro completo voltado para o atendimento infantil e de adolescentes, incluindo visão dos pais e do paciente.',
        topics: [
            {
                id: 'motivo_encaminhamento',
                title: 'Motivo do encaminhamento e percepção dos pais',
                description: 'Investigar motivos da busca, percepção dos pais sobre o problema e coincidência com o comportamento real. Quem encaminhou? Qual a expectativa? A criança entende por que está aqui?'
            },
            {
                id: 'desenvolvimento_infantil',
                title: 'Desenvolvimento infantil',
                description: 'Marcos do desenvolvimento, vínculo parental, complicações no parto, amamentação, quando sentou, andou, falou, etc.'
            },
            {
                id: 'vida_escolar_pais',
                title: 'Vida escolar e aprendizado (Visão dos Pais)',
                description: 'Histórico escolar, rendimento, queixas da escola, reprovações, trocas de escola, apoio nos estudos.'
            },
            {
                id: 'rotina_pais',
                title: 'Rotina, sono e alimentação (Visão dos Pais)',
                description: 'Qualidade da rotina, atividades extracurriculares, sono (horário/qualidade), alimentação, supervisão de higiene.'
            },
            {
                id: 'relacoes_familiares_pais',
                title: 'Relações familiares (Visão dos Pais)',
                description: 'Configuração familiar, qualidade dos vínculos, perdas significativas, histórico de terapia dos pais.'
            },
            {
                id: 'historico_saude',
                title: 'Histórico de saúde',
                description: 'Doenças diagnosticadas, medicação, internações, atendimentos anteriores (psicologia, fono, etc.).'
            },
            {
                id: 'historico_familiar_psiquico',
                title: 'Histórico familiar de sofrimento psíquico',
                description: 'Transtornos mentais na família, dependência de substâncias, suicídio, histórico de violência.'
            },
            {
                id: 'expectativas_valores',
                title: 'Expectativas e valores familiares',
                description: 'Valores que desejam transmitir, expectativas de futuro, crenças religiosas e costumes.'
            },
            {
                id: 'vinculo_terapia_paciente',
                title: 'Vínculo com a terapia (Visão do Paciente)',
                description: 'Compreensão do paciente sobre o processo, se quis vir, se gosta de vir, experiências anteriores.'
            },
            {
                id: 'vida_escolar_paciente',
                title: 'Vida escolar (Visão do Paciente)',
                description: 'Experiência subjetiva na escola, amigos, matérias favoritas/difíceis, relação com professores.'
            },
            {
                id: 'rotina_interesses_paciente',
                title: 'Rotina e interesses (Visão do Paciente)',
                description: 'O que faz na semana/tempo livre, hobbies, autonomia nas escolhas de atividades.'
            },
            {
                id: 'autocuidado_paciente',
                title: 'Sono, alimentação e higiene (Visão do Paciente)',
                description: 'Qualidade do sono, pesadelos, alimentação, autonomia no banho e higiene.'
            },
            {
                id: 'relacoes_familiares_paciente',
                title: 'Relações familiares (Visão do Paciente)',
                description: 'Com quem mora, relação com pais e irmãos, quem cuida mais, quem briga mais.'
            },
            {
                id: 'reacoes_comportamentos',
                title: 'Reações e comportamentos',
                description: 'Manejo da frustração, reações a broncas/castigos, expressões de sofrimento (se machucar, chorar muito).'
            },
            {
                id: 'sexualidade_seguranca',
                title: 'Sexualidade e segurança (para adolescentes)',
                description: 'Percepção sobre sexualidade, consentimento, riscos, educação sexual, exposição indevida.'
            },
            {
                id: 'saude_corpo',
                title: 'Saúde e corpo',
                description: 'Percepção do próprio corpo, queixas somáticas (dor de barriga, cabeça), uso de óculos/aparelho.'
            }
        ]
    }
];
