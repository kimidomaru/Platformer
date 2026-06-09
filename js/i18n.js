// I18N — internationalization engine (PT/EN)
var I18N = (function () {

  var _strings = {
    pt: {
      // Tabs
      theory: 'Teoria',
      quiz: 'Quiz',
      flashcards: 'Flashcards',
      lab: 'Lab',
      troubleshooting: 'Troubleshooting',

      // Status
      'not-started': 'Pendente',
      'in-progress': 'Em Progresso',
      completed: 'Concluido',

      // Search
      searchPlaceholder: 'Buscar topicos...',
      noResults: 'Nenhum resultado',

      // Sidebar
      certAll: 'Todos',
      comingSoon: 'Em breve...',
      btnDashboard: 'Dashboard',
      btnExam: 'Simulado',
      btnAssessment: 'Avaliacao',
      btnCheatsheet: 'Cheatsheet',

      // Quiz
      studyMore: 'Estude mais:',
      prevQuestion: '← Anterior',
      nextQuestion: 'Proxima →',
      checkAnswer: 'Verificar',
      viewResults: 'Ver Resultado',
      excellentResult: 'Excelente! Voce domina este topico.',
      goodResult: 'Bom, mas revise os pontos que errou.',
      poorResult: 'Recomendado revisar a teoria antes de tentar novamente.',
      tryAgain: 'Tentar Novamente',
      noQuestions: 'Nenhuma questao disponivel para este topico.',
      correctOf: 'de',
      corrects: 'corretas',

      // Flashcards
      noFlashcards: 'Nenhum flashcard disponivel.',
      shuffle: '⇄ Embaralhar',
      flashcardClickHint: 'cards — clique para virar',

      // SRS / Spaced repetition
      srsAgain: 'Errei',
      srsHard: 'Dificil',
      srsGood: 'Bom',
      srsEasy: 'Facil',
      srsScheduled: 'Agendado para revisao espacada',
      btnReview: 'Revisao',
      reviewTitle: '⏱ Revisao',
      reviewRemaining: 'restantes',
      reviewFlipHint: 'Clique para ver a resposta',
      reviewShowAnswer: 'Mostrar Resposta',
      reviewNoCards: 'Nenhum flashcard agendado ainda. Avalie cards nas abas de Flashcards dos topicos para iniciar a revisao espacada.',
      reviewAllDone: 'Tudo em dia! Nenhum card para revisar hoje.',
      reviewTrackedSuffix: 'cards no sistema de revisao espacada.',
      reviewSessionDone: 'Sessao de revisao concluida!',
      reviewCardsReviewed: 'cards revisados.',
      reviewDueWidget: 'Revisao do Dia',
      reviewDueCards: 'cards para revisar',
      reviewStartBtn: 'Iniciar Revisao',
      reviewUpToDate: 'Nenhum card pendente — tudo em dia!',

      // Constellation map
      btnMap: 'Mapa',
      mapTitle: '✦ Mapa de Topicos',
      mapSubtitle: 'Constelacao de topicos conectados por tags e dominio. Clique num no para acender os relacionados; busque para destacar; arraste para reorganizar; role para dar zoom.',
      mapSearchPlaceholder: 'Destacar por nome ou tag...',
      mapAllCerts: 'Todas as trilhas',
      mapReset: '↺ Reorganizar',
      mapConnected: 'Conectados',
      mapRelLinked: 'topico vinculado',
      mapOpenTopic: 'Abrir Topico →',

      // Quiz auto-progress + weak-spot review
      autoCompleted: 'Topico marcado como concluido (≥80% no quiz)!',
      weakReview: '🧪 Revisar Pontos Fracos',
      weakReviewDesc: 'questoes que voce errou',
      weakReviewSub: 'Refaca so o que errou',
      weakNone: 'Nenhum ponto fraco no momento. Mande bem nos quizzes!',
      weakRemaining: 'Pontos fracos restantes:',
      weakWidgetTitle: 'Pontos Fracos',
      weakWidgetSub: 'questoes erradas para revisar',
      weakWidgetBtn: 'Revisar Erros',

      // Lab
      examModeLabel: '🔥 Modo Exame',
      examModeBadge: '🔥 Modo Exame',
      exitExamMode: '✖ Sair do Modo Exame',
      examModeTitle: 'Esconde dicas e solucoes — simule o exame real',
      stopwatchLabel: '▶ Cronometro',
      pauseLabel: '⏸ Pausar',
      noLab: 'Nenhum lab disponivel.',
      scenarioLabel: 'Cenario:',
      objectiveLabel: 'Objetivo:',
      estimatedTime: 'Tempo estimado:',
      hintLabel: '💡 Dica',
      viewSolution: '✅ Ver Solucao',
      verifyLabel: '🔍 Verificar',
      hiddenHints: 'dica(s) oculta(s) no Modo Exame.',

      // Troubleshooting
      noTroubleshooting: 'Nenhum cenario de troubleshooting.',
      symptomLabel: 'Sintoma:',
      diagnosisLabel: '🔍 Diagnostico',
      solutionLabel: '✅ Solucao',

      // Renderer
      topicNotFound: 'Topico nao encontrado.',

      // Dashboard
      dashboardTitle: '📊 Dashboard',
      totalTopics: 'Total de Topicos',
      completedTopics: 'Concluidos',
      inProgressTopics: 'Em Progresso',
      overallProgress: 'Progresso Geral',
      exportBtn: 'Exportar',
      importBtn: 'Importar',
      exportHint: 'Baixar um backup do seu progresso (JSON)',
      importHint: 'Restaurar progresso de um arquivo de backup',
      importConfirm: 'Importar vai sobrescrever seu progresso atual neste navegador. Continuar?',
      importInvalid: 'Arquivo de backup invalido.',
      importDone: 'Backup restaurado ({n} itens). Recarregando...',
      domainProgressTitle: 'Progresso por Dominio',
      recentTopicsTitle: 'Estudados Recentemente',
      quizResultsTitle: 'Resultados dos Quizzes',
      allCertsDone: 'Todas as certificacoes Kubernetes concluidas!',
      completeCerts: 'Complete as certificacoes CNCF Kubernetes',
      cloudCertsDone: 'Todas as certificacoes cloud concluidas!',
      completeCloudCerts: 'Complete as certificacoes cloud',

      // Exam
      examTitle: '⏰ Simulado',
      examIntro: 'Selecione o modo e inicie o simulado. As questoes sao selecionadas aleatoriamente dos topicos carregados. Score minimo para aprovacao:',
      questionBank: 'Banco de questoes:',
      topicsWithQuiz: 'topicos com quiz disponivel.',
      fullExam: 'Simulado Completo',
      fullExamDesc: '2 horas • Todas as questoes',
      fullExamSub: 'Simula o exame real',
      quickMode: 'Modo Rapido',
      quickModeDesc: '30 min • 20 questoes',
      quickModeSub: 'Revisao rapida',
      byDomain: 'Por Dominio',
      byDomainDesc: 'Foco em um dominio',
      byDomainSub: 'Estudo direcionado',
      byCert: 'Por Certificacao',
      byCertDesc: 'Simulado de uma cert especifica',
      byCertSub: 'CKA, AZ-104, SAA...',
      selectCertTitle: '🎓 Selecione a Certificacao',
      selectCertDesc: 'Escolha uma certificacao para um simulado focado apenas nas questoes dela.',
      topicsWithQuizInCert: 'topicos com quiz nesta cert',
      passScoreLabel: 'Nota de aprovacao:',
      examModeOriented: 'Simulado orientado por certificacao/skill (recomendado)',
      examModeGeneral: 'Modos gerais',
      examModeGeneralNote: 'Atencao: estes modos misturam questoes de TODAS as certificacoes e skills. Use apenas para revisao ampla.',
      bySkill: 'Por Skill',
      bySkillDesc: 'Simulado de uma skill especifica',
      bySkillSub: 'ArgoCD, Prometheus, Istio...',
      selectSkillTitle: '🛠️ Selecione a Skill',
      selectSkillDesc: 'Escolha uma skill para um simulado focado apenas nas questoes dela.',
      topicsWithQuizInSkill: 'topicos com quiz nesta skill',
      generalExam: 'Simulado Geral (misto)',
      generalExamDesc: '2 horas • Todas as certificacoes',
      generalExamSub: 'Mistura tudo',
      chooseLengthTitle: '⏱️ Escolha a duracao',
      chooseLengthDesc: 'Foco do simulado:',
      challenge: 'Desafio',
      challengeDesc: '45 min • 25 questoes',
      challengeSub: 'Tempo reduzido',
      lastResult: 'Ultimo resultado',
      examHistory: 'Historico de Simulados',
      passedLabel: 'Aprovado',
      failedLabel: 'Reprovado',
      questionLabel: 'Questao',
      answeredLabel: 'respondidas',
      domainLabel: 'Dominio:',
      flagLabel: '⚑ Marcar',
      flaggedLabel: '⚑ Marcada',
      prevLabel: '← Anterior',
      nextLabel: 'Proxima →',
      finishLabel: 'Finalizar',
      quickNavLabel: 'Navegacao rapida:',
      legendAnswered: 'Respondida',
      legendFlagged: 'Marcada',
      legendCurrent: 'Atual',
      loadingQuestions: 'Carregando questoes...',
      unansweredWarning: ' questoes nao respondidas. Deseja finalizar mesmo assim?',
      minScore: 'Score minimo:',
      timeUsed: 'Tempo usado:',
      domainPerformance: 'Desempenho por Dominio',
      newExam: 'Novo Simulado',
      reviewAnswers: 'Revisar Respostas',
      reviewTitle: '🔍 Revisao das Respostas',
      backToExam: '← Voltar ao Simulado',
      filterAll: 'Todas',
      filterWrong: 'Apenas Erradas',
      filterUnanswered: 'Nao Respondidas',
      noQuestionsCategory: 'Nenhuma questao nesta categoria.',
      explanationLabel: 'Explicacao:',
      yourAnswer: '(sua resposta)',
      selectDomainTitle: '🎯 Selecione o Dominio',
      selectDomainDesc: 'Escolha um dominio para focar o simulado. Todas as questoes do dominio serao incluidas.',
      topicsWithQuizIn: 'topicos com quiz',
      backLabel: '← Voltar',
      loadingError: 'Erro ao carregar questoes.',
      noQuestionsAvailable: 'Nenhuma questao disponivel. Adicione topicos com quiz.',
      histColNum: '#',
      histColDate: 'Data',
      histColScore: 'Score',
      histColQuestions: 'Questoes',
      histColResult: 'Resultado',
      correctsOf: 'corretas',

      // Assessment
      assessmentTitle: '🎯 Avaliacao',
      assessmentPageTitle: 'Avaliacao de Desempenho',
      assessDomainView: 'Visao por Dominio',
      assessMinRadar: 'Minimo 3 dominios para o grafico radar.',
      assessMinScore: 'Score minimo:',
      assessEstimate: 'Estimativa:',
      assessWeight: 'Peso:',
      assessTopics: 'Topicos:',
      assessAttempted: 'tentados',
      assessWeakDomains: 'Dominios Fracos',
      assessReinforce: 'Reforcar',
      assessRecommendation: 'Recomendacao:',
      assessFocusOn: 'Foque em:',
      assessKeepPracticing: 'Continue praticando para manter o nivel!',
      masteryDominado: 'Dominado',
      masteryAvancado: 'Avancado',
      masteryIntermediario: 'Intermediario',
      masteryIniciante: 'Iniciante',
      masteryNaoIniciado: 'Nao Iniciado',
      readinessPreparado: 'Preparado',
      readinessQuasePronto: 'Quase Pronto',
      readinessEmPreparacao: 'Em Preparacao',
      readinessNaoPreparado: 'Nao Preparado',

      // Cheatsheet
      cheatsheetTitle: 'Cheatsheet kubectl',
      cheatsheetSubtitle: 'Referencia rapida dos comandos mais usados no CKA.',

      // Language banner
      ptOnlyBanner: '🇧🇷 Este tópico ainda não está disponível em inglês. Exibindo em Português.',

      // Lang toggle
      langToggleLabel: '🇺🇸 EN',
      langToggleTitle: 'Switch to English',

      // Sidebar sections (certs vs skills)
      sectionCerts: 'Certificacoes',
      sectionSkills: 'Skills',
      skillTrackAll: 'Todos',

      // Dashboard — Skills progress
      skillsProgressTitle: 'Progresso — Skills',
      skillsSubtitle: 'Habilidades laterais do ecossistema cloud-native',
      noSkillsYet: 'Nenhum conteudo de skill disponivel ainda.',

      // Exam — skill quiz
      skillQuiz: 'Quiz de Skills',
      skillQuizDesc: '30 min • Skills',
      skillQuizSub: 'Teste suas habilidades laterais',

      // Assessment — skills
      assessSkillsSection: 'Skills',
      assessNoCertWeight: 'N/A',

      // Quiz Analytics
      quizAnalyticsTitle: '📊 Analytics de Quiz',
      quizAnalyticsSub: 'topicos avaliados',
      quizAnalyticsGood: 'Dominado',
      quizAnalyticsFair: 'Em desenvolvimento',
      quizAnalyticsWeak: 'Requer atencao',
      quizAnalyticsTopics: 'topicos',
      quizAnalyticsOverall: 'Media geral:',

      // Notes
      notesTitle: '📝 Minhas Anotacoes',
      notesPlaceholder: 'Escreva suas anotacoes sobre este topico...',
      notesSaved: '✓ Salvo',
      notesClear: 'Limpar',
      notesClearConfirm: 'Limpar todas as anotacoes deste topico?',

      // Trails / Roadmap
      trailsTitle: '🗺️ Trilhas de Aprendizado',
      trailsSubtitle: 'Escolha sua area de atuacao e siga a sequencia recomendada de estudos.',
      btnTrails: 'Trilhas',
      trailActive: 'Em Progresso',
      trailStart: 'Iniciar Trilha →',
      trailContinue: 'Continuar Trilha →',
      trailLevels: 'niveis',
      trailTopicsCount: 'topicos',
      trailComplete: 'concluido',
      trailBack: 'Trilhas',
      trailTopicsDone: 'topicos concluidos',
      trailCertLabel: 'Meta:',
      trailExamBtn: '▶ Iniciar Simulado',
      trailCheckpoint: 'Checkpoint',
      trailCheckpointDone: 'Concluido',

      // Roadmap (roadmap.sh-style visual paths)
      btnRoadmap: 'Roadmap',
      roadmapTitle: '🛠️ Roadmaps Visuais',
      roadmapSubtitle: 'Caminhos com bifurcacoes (recomendado · alternativo · opcional) ligados direto ao conteudo.',
      roadmapOpen: 'Abrir Roadmap →',
      roadmapBack: 'Roadmaps',
      roadmapForks: 'bifurcacoes',
      roadmapRecommended: 'recomendado',
      roadmapAlternative: 'alternativo',
      roadmapOptional: 'opcional',
      trailViewRoadmap: 'Roadmap',
      trailViewList: 'Lista',
      roadmapOnlyBadge: 'Roadmap'
    },

    en: {
      // Tabs
      theory: 'Theory',
      quiz: 'Quiz',
      flashcards: 'Flashcards',
      lab: 'Lab',
      troubleshooting: 'Troubleshooting',

      // Status
      'not-started': 'Not Started',
      'in-progress': 'In Progress',
      completed: 'Completed',

      // Search
      searchPlaceholder: 'Search topics...',
      noResults: 'No results found',

      // Sidebar
      certAll: 'All',
      comingSoon: 'Coming soon...',
      btnDashboard: 'Dashboard',
      btnExam: 'Mock Exam',
      btnAssessment: 'Assessment',
      btnCheatsheet: 'Cheatsheet',

      // Quiz
      studyMore: 'Study more:',
      prevQuestion: '← Previous',
      nextQuestion: 'Next →',
      checkAnswer: 'Check Answer',
      viewResults: 'View Results',
      excellentResult: 'Excellent! You have mastered this topic.',
      goodResult: 'Good, but review the questions you got wrong.',
      poorResult: 'Recommended: review the theory before trying again.',
      tryAgain: 'Try Again',
      noQuestions: 'No questions available for this topic.',
      correctOf: 'of',
      corrects: 'correct',

      // Flashcards
      noFlashcards: 'No flashcards available.',
      shuffle: '⇄ Shuffle',
      flashcardClickHint: 'cards — click to flip',

      // SRS / Spaced repetition
      srsAgain: 'Again',
      srsHard: 'Hard',
      srsGood: 'Good',
      srsEasy: 'Easy',
      srsScheduled: 'Scheduled for spaced review',
      btnReview: 'Review',
      reviewTitle: '⏱ Review',
      reviewRemaining: 'remaining',
      reviewFlipHint: 'Click to reveal the answer',
      reviewShowAnswer: 'Show Answer',
      reviewNoCards: 'No flashcards scheduled yet. Grade cards in the Flashcards tab of any topic to start spaced repetition.',
      reviewAllDone: 'All caught up! No cards due today.',
      reviewTrackedSuffix: 'cards in the spaced-repetition system.',
      reviewSessionDone: 'Review session complete!',
      reviewCardsReviewed: 'cards reviewed.',
      reviewDueWidget: 'Daily Review',
      reviewDueCards: 'cards due',
      reviewStartBtn: 'Start Review',
      reviewUpToDate: 'No cards due — all caught up!',

      // Constellation map
      btnMap: 'Map',
      mapTitle: '✦ Topic Map',
      mapSubtitle: 'Constellation of topics linked by tags and domain. Click a node to light up related ones; search to highlight; drag to rearrange; scroll to zoom.',
      mapSearchPlaceholder: 'Highlight by name or tag...',
      mapAllCerts: 'All tracks',
      mapReset: '↺ Re-layout',
      mapConnected: 'Connected',
      mapRelLinked: 'linked topic',
      mapOpenTopic: 'Open Topic →',

      // Quiz auto-progress + weak-spot review
      autoCompleted: 'Topic marked complete (≥80% on quiz)!',
      weakReview: '🧪 Weak-Spot Review',
      weakReviewDesc: 'questions you got wrong',
      weakReviewSub: 'Retry only your mistakes',
      weakNone: 'No weak spots right now. Great quiz work!',
      weakRemaining: 'Weak spots remaining:',
      weakWidgetTitle: 'Weak Spots',
      weakWidgetSub: 'wrong questions to review',
      weakWidgetBtn: 'Review Mistakes',

      // Lab
      examModeLabel: '🔥 Exam Mode',
      examModeBadge: '🔥 Exam Mode',
      exitExamMode: '✖ Exit Exam Mode',
      examModeTitle: 'Hides hints and solutions — simulate the real exam',
      stopwatchLabel: '▶ Stopwatch',
      pauseLabel: '⏸ Pause',
      noLab: 'No lab available.',
      scenarioLabel: 'Scenario:',
      objectiveLabel: 'Objective:',
      estimatedTime: 'Estimated time:',
      hintLabel: '💡 Hint',
      viewSolution: '✅ View Solution',
      verifyLabel: '🔍 Verify',
      hiddenHints: 'hint(s) hidden in Exam Mode.',

      // Troubleshooting
      noTroubleshooting: 'No troubleshooting scenarios.',
      symptomLabel: 'Symptom:',
      diagnosisLabel: '🔍 Diagnosis',
      solutionLabel: '✅ Solution',

      // Renderer
      topicNotFound: 'Topic not found.',

      // Dashboard
      dashboardTitle: '📊 Dashboard',
      totalTopics: 'Total Topics',
      completedTopics: 'Completed',
      inProgressTopics: 'In Progress',
      overallProgress: 'Overall Progress',
      exportBtn: 'Export',
      importBtn: 'Import',
      exportHint: 'Download a backup of your progress (JSON)',
      importHint: 'Restore progress from a backup file',
      importConfirm: 'Importing will overwrite your current progress in this browser. Continue?',
      importInvalid: 'Invalid backup file.',
      importDone: 'Backup restored ({n} items). Reloading...',
      domainProgressTitle: 'Progress by Domain',
      recentTopicsTitle: 'Recently Studied',
      quizResultsTitle: 'Quiz Results',
      allCertsDone: 'All Kubernetes certifications completed!',
      completeCerts: 'Complete the CNCF Kubernetes certifications',
      cloudCertsDone: 'All cloud certifications completed!',
      completeCloudCerts: 'Complete the cloud certifications',

      // Exam
      examTitle: '⏰ Mock Exam',
      examIntro: 'Select the mode and start the exam. Questions are randomly selected from loaded topics. Minimum passing score:',
      questionBank: 'Question bank:',
      topicsWithQuiz: 'topics with quiz available.',
      fullExam: 'Full Mock Exam',
      fullExamDesc: '2 hours • All questions',
      fullExamSub: 'Simulates the real exam',
      quickMode: 'Quick Mode',
      quickModeDesc: '30 min • 20 questions',
      quickModeSub: 'Quick review',
      byDomain: 'By Domain',
      byDomainDesc: 'Focus on one domain',
      byDomainSub: 'Directed study',
      byCert: 'By Certification',
      byCertDesc: 'Mock exam for a specific cert',
      byCertSub: 'CKA, AZ-104, SAA...',
      selectCertTitle: '🎓 Select Certification',
      selectCertDesc: 'Choose a certification for a mock exam focused only on its questions.',
      topicsWithQuizInCert: 'quiz topics in this cert',
      passScoreLabel: 'Passing score:',
      examModeOriented: 'Certification/skill-focused exam (recommended)',
      examModeGeneral: 'General modes',
      examModeGeneralNote: 'Note: these modes mix questions from ALL certifications and skills. Use only for broad review.',
      bySkill: 'By Skill',
      bySkillDesc: 'Mock exam for a specific skill',
      bySkillSub: 'ArgoCD, Prometheus, Istio...',
      selectSkillTitle: '🛠️ Select Skill',
      selectSkillDesc: 'Choose a skill for a mock exam focused only on its questions.',
      topicsWithQuizInSkill: 'quiz topics in this skill',
      generalExam: 'General Exam (mixed)',
      generalExamDesc: '2 hours • All certifications',
      generalExamSub: 'Mixes everything',
      chooseLengthTitle: '⏱️ Choose the length',
      chooseLengthDesc: 'Exam focus:',
      challenge: 'Challenge',
      challengeDesc: '45 min • 25 questions',
      challengeSub: 'Reduced time',
      lastResult: 'Last result',
      examHistory: 'Exam History',
      passedLabel: 'Passed',
      failedLabel: 'Failed',
      questionLabel: 'Question',
      answeredLabel: 'answered',
      domainLabel: 'Domain:',
      flagLabel: '⚑ Flag',
      flaggedLabel: '⚑ Flagged',
      prevLabel: '← Previous',
      nextLabel: 'Next →',
      finishLabel: 'Finish',
      quickNavLabel: 'Quick navigation:',
      legendAnswered: 'Answered',
      legendFlagged: 'Flagged',
      legendCurrent: 'Current',
      loadingQuestions: 'Loading questions...',
      unansweredWarning: ' unanswered questions. Do you want to finish anyway?',
      minScore: 'Minimum score:',
      timeUsed: 'Time used:',
      domainPerformance: 'Performance by Domain',
      newExam: 'New Exam',
      reviewAnswers: 'Review Answers',
      reviewTitle: '🔍 Answer Review',
      backToExam: '← Back to Exam',
      filterAll: 'All',
      filterWrong: 'Wrong Only',
      filterUnanswered: 'Unanswered',
      noQuestionsCategory: 'No questions in this category.',
      explanationLabel: 'Explanation:',
      yourAnswer: '(your answer)',
      selectDomainTitle: '🎯 Select Domain',
      selectDomainDesc: 'Choose a domain to focus the exam. All domain questions will be included.',
      topicsWithQuizIn: 'topics with quiz',
      backLabel: '← Back',
      loadingError: 'Error loading questions.',
      noQuestionsAvailable: 'No questions available. Add topics with quiz.',
      histColNum: '#',
      histColDate: 'Date',
      histColScore: 'Score',
      histColQuestions: 'Questions',
      histColResult: 'Result',
      correctsOf: 'correct',

      // Assessment
      assessmentTitle: '🎯 Assessment',
      assessmentPageTitle: 'Performance Assessment',
      assessDomainView: 'Domain Overview',
      assessMinRadar: 'Minimum 3 domains required for the radar chart.',
      assessMinScore: 'Minimum score:',
      assessEstimate: 'Estimate:',
      assessWeight: 'Weight:',
      assessTopics: 'Topics:',
      assessAttempted: 'attempted',
      assessWeakDomains: 'Weak Domains',
      assessReinforce: 'Reinforce',
      assessRecommendation: 'Recommendation:',
      assessFocusOn: 'Focus on:',
      assessKeepPracticing: 'Keep practicing to maintain your level!',
      masteryDominado: 'Mastered',
      masteryAvancado: 'Advanced',
      masteryIntermediario: 'Intermediate',
      masteryIniciante: 'Beginner',
      masteryNaoIniciado: 'Not Started',
      readinessPreparado: 'Ready',
      readinessQuasePronto: 'Almost Ready',
      readinessEmPreparacao: 'In Progress',
      readinessNaoPreparado: 'Not Ready',

      // Cheatsheet
      cheatsheetTitle: 'kubectl Cheatsheet',
      cheatsheetSubtitle: 'Quick reference for the most commonly used Kubernetes commands.',

      // Language banner
      ptOnlyBanner: '🇧🇷 This topic is not yet available in English. Displaying in Portuguese.',

      // Lang toggle
      langToggleLabel: '🇧🇷 PT',
      langToggleTitle: 'Mudar para Português',

      // Sidebar sections (certs vs skills)
      sectionCerts: 'Certifications',
      sectionSkills: 'Skills',
      skillTrackAll: 'All',

      // Dashboard — Skills progress
      skillsProgressTitle: 'Progress — Skills',
      skillsSubtitle: 'Lateral skills across the cloud-native ecosystem',
      noSkillsYet: 'No skill content available yet.',

      // Exam — skill quiz
      skillQuiz: 'Skill Quiz',
      skillQuizDesc: '30 min • Skills',
      skillQuizSub: 'Test your lateral skills',

      // Assessment — skills
      assessSkillsSection: 'Skills',
      assessNoCertWeight: 'N/A',

      // Quiz Analytics
      quizAnalyticsTitle: '📊 Quiz Analytics',
      quizAnalyticsSub: 'topics evaluated',
      quizAnalyticsGood: 'Mastered',
      quizAnalyticsFair: 'Developing',
      quizAnalyticsWeak: 'Needs work',
      quizAnalyticsTopics: 'topics',
      quizAnalyticsOverall: 'Overall average:',

      // Notes
      notesTitle: '📝 My Notes',
      notesPlaceholder: 'Write your notes about this topic...',
      notesSaved: '✓ Saved',
      notesClear: 'Clear',
      notesClearConfirm: 'Clear all notes for this topic?',

      // Trails / Roadmap
      trailsTitle: '🗺️ Learning Trails',
      trailsSubtitle: 'Choose your role and follow the recommended study sequence.',
      btnTrails: 'Trails',
      trailActive: 'In Progress',
      trailStart: 'Start Trail →',
      trailContinue: 'Continue Trail →',
      trailLevels: 'levels',
      trailTopicsCount: 'topics',
      trailComplete: 'complete',
      trailBack: 'Trails',
      trailTopicsDone: 'topics done',
      trailCertLabel: 'Goal:',
      trailExamBtn: '▶ Start Mock Exam',
      trailCheckpoint: 'Checkpoint',
      trailCheckpointDone: 'Done',

      // Roadmap (roadmap.sh-style visual paths)
      btnRoadmap: 'Roadmap',
      roadmapTitle: '🛠️ Visual Roadmaps',
      roadmapSubtitle: 'Branching paths (recommended · alternative · optional) linked straight to the content.',
      roadmapOpen: 'Open Roadmap →',
      roadmapBack: 'Roadmaps',
      roadmapForks: 'forks',
      roadmapRecommended: 'recommended',
      roadmapAlternative: 'alternative',
      roadmapOptional: 'optional',
      trailViewRoadmap: 'Roadmap',
      trailViewList: 'List',
      roadmapOnlyBadge: 'Roadmap'
    }
  };

  function _getLangFromStorage() {
    try {
      var raw = localStorage.getItem('k8s_lang');
      return raw === 'en' ? 'en' : 'pt';
    } catch (e) { return 'pt'; }
  }

  function _saveLang(lang) {
    try { localStorage.setItem('k8s_lang', lang); } catch (e) {}
  }

  var _lang = _getLangFromStorage();

  function init() {
    _lang = _getLangFromStorage();
    _applyToDOM();
  }

  function t(key) {
    var str = _strings[_lang] && _strings[_lang][key];
    if (str !== undefined) return str;
    var fb = _strings.pt && _strings.pt[key];
    return fb !== undefined ? fb : key;
  }

  function getLang() { return _lang; }

  function setLang(lang) {
    if (lang !== 'pt' && lang !== 'en') return;
    _lang = lang;
    _saveLang(lang);
    _applyToDOM();
    // Re-route to refresh rendered content
    var hash = window.location.hash || '#dashboard';
    window.location.hash = '';
    // Small delay so hash change is detected
    setTimeout(function () { window.location.hash = hash; }, 20);
  }

  function _applyToDOM() {
    document.documentElement.lang = _lang === 'en' ? 'en' : 'pt-BR';

    var searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.placeholder = t('searchPlaceholder');

    var langBtn = document.getElementById('lang-toggle');
    if (langBtn) {
      langBtn.textContent = t('langToggleLabel');
      langBtn.title = t('langToggleTitle');
      langBtn.setAttribute('aria-label', t('langToggleTitle'));
    }

    // Update sidebar footer buttons labels
    var btnExam = document.getElementById('btn-exam');
    var btnAssess = document.getElementById('btn-assessment');
    if (btnExam) btnExam.innerHTML = '<span>&#9200;</span> ' + t('btnExam');
    if (btnAssess) btnAssess.innerHTML = '<span>&#127919;</span> ' + t('btnAssessment');

    var reviewLabel = document.querySelector('#btn-review .btn-review-label');
    if (reviewLabel) reviewLabel.textContent = t('btnReview');

    var mapLabel = document.querySelector('#btn-map .btn-map-label');
    if (mapLabel) mapLabel.textContent = t('btnMap');

    var trailsLabel = document.querySelector('#btn-trails .btn-trails-label');
    if (trailsLabel) trailsLabel.textContent = t('btnTrails');
  }

  return {
    init: init,
    t: t,
    getLang: getLang,
    setLang: setLang
  };
})();
