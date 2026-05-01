// State Management
let examsData = {};
let metadata = {};
let currentExam = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let wrongQuestions = [];
let allFailedQuestions = [];
let questionStats = {};
let isMarathon = false;
let isFailedReview = false;

// Timer State
let timerInterval = null;
let timeLeft = 0; // seconds
let startTime = 0;
const EXAM_TIME_LIMIT = 45 * 60; // 45 minutes in seconds
const HISTORY_API_URL = 'api/history';

// DOM Elements
const homeView = document.getElementById('home-view');
const quizView = document.getElementById('quiz-view');
const resultView = document.getElementById('result-view');
const examList = document.getElementById('exam-list');
const britizenExamList = document.getElementById('britizen-exam-list');
const homeBtn = document.getElementById('home-btn');
const stopBtn = document.getElementById('stop-btn');
const subtitle = document.getElementById('subtitle');
const timerDisplay = document.getElementById('timer');
const progress = document.getElementById('progress');
const questionText = document.getElementById('question-text');
const answersContainer = document.getElementById('answers-container');
const feedbackContainer = document.getElementById('feedback-container');
const resultStatus = document.getElementById('result-status');
const explanationText = document.getElementById('explanation-text');
const checkBtn = document.getElementById('check-btn');
const nextBtn = document.getElementById('next-btn');
const lastUpdatedSpan = document.getElementById('last-updated');

// Result View Elements
const scoreText = document.getElementById('score-text');
const scorePercentage = document.getElementById('score-percentage');
const timeTakenText = document.getElementById('time-taken-text');
const timeUpMsg = document.getElementById('time-up-msg');
const wrongAnswersContainer = document.getElementById('wrong-answers-container');
const wrongAnswersList = document.getElementById('wrong-answers-list');
const restartBtn = document.getElementById('restart-btn');
const resultHomeBtn = document.getElementById('result-home-btn');

// Home Mode Buttons
const randomExamBtn = document.getElementById('random-exam-btn');
const marathonBtn = document.getElementById('marathon-btn');
const failedQuestionsSection = document.getElementById('failed-questions-section');
const failedQuestionsCount = document.getElementById('failed-questions-count');
const failedQuestionsList = document.getElementById('failed-questions-list');
const retakeFailedExamBtn = document.getElementById('retake-failed-exam-btn');
const retakeFailedAttentionBtn = document.getElementById('retake-failed-attention-btn');
const retakeFailedAllBtn = document.getElementById('retake-failed-all-btn');
const clearFailedQuestionsBtn = document.getElementById('clear-failed-questions-btn');
const homeTabs = document.querySelectorAll('.home-tab');
const homeTabPanels = document.querySelectorAll('.home-tab-panel');
const dashboardSummary = document.getElementById('dashboard-summary');
const dashboardMetrics = document.getElementById('dashboard-metrics');
const questionStatsList = document.getElementById('question-stats-list');
const questionStatsFilter = document.getElementById('question-stats-filter');
const clearQuestionStatsBtn = document.getElementById('clear-question-stats-btn');
const masteryProgressSummary = document.getElementById('mastery-progress-summary');
const masteryProgressPercent = document.getElementById('mastery-progress-percent');
const masteryProgressFill = document.getElementById('mastery-progress-fill');
const masteryProgressInsights = document.getElementById('mastery-progress-insights');

// Initialization
async function init() {
    try {
        const response = await fetch('exams.json');
        const data = await response.json();
        examsData = data.exams || data;
        metadata = data.metadata || {};
        annotateQuestionHistoryKeys();
        
        if (metadata.lastUpdated && lastUpdatedSpan) {
            lastUpdatedSpan.textContent = metadata.lastUpdated;
        }
        
        allFailedQuestions = loadFailedQuestions();
        questionStats = loadQuestionStats();
        await syncHistoryFromServer();
        normalizeHistoryForQuestionBank();
        
        renderExamList();
        renderMasteryProgress();
        renderQuestionDashboard();
        renderFailedQuestionsHome();
    } catch (error) {
        console.error('Failed to load exams data:', error);
        examList.innerHTML = '<p>Error loading exams. Please ensure exams.json exists.</p>';
    }
}

function renderExamList() {
    examList.innerHTML = '';
    if (britizenExamList) {
        britizenExamList.innerHTML = '';
    }

    Object.keys(examsData).forEach(examNum => {
        const btn = document.createElement('button');
        btn.textContent = getExamLabel(examNum);
        btn.onclick = () => startExam(examNum);

        if (isBritizenExam(examNum)) {
            if (britizenExamList) {
                britizenExamList.appendChild(btn);
            }
        } else {
            examList.appendChild(btn);
        }
    });
}

function getExamLabel(examNum) {
    return String(examNum).startsWith('Britizen ') ? examNum : `Exam ${examNum}`;
}

function isBritizenExam(examNum) {
    return String(examNum).startsWith('Britizen ');
}

function isBritizenQuestion(question) {
    return question && (question.source === 'Britizen' || String(question.historyKey || '').startsWith('britizen:'));
}

function annotateQuestionHistoryKeys() {
    Object.entries(examsData).forEach(([examNum, examQuestions]) => {
        examQuestions.forEach((question, index) => {
            question.historyKey = question.historyKey || `exam:${examNum}:question:${question.id || index + 1}`;
        });
    });
}

function switchHomeTab(tabName) {
    homeTabs.forEach(tab => {
        const isActive = tab.id === `${tabName}-tab-btn`;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive.toString());
    });

    homeTabPanels.forEach(panel => {
        panel.classList.toggle('active', panel.id === `${tabName}-tab`);
    });
}

// Fisher-Yates Shuffle
function shuffle(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function getAllQuestions() {
    let all = [];
    Object.values(examsData).forEach(examQuestions => {
        all = all.concat(examQuestions);
    });
    return all;
}

function getCoreQuestions() {
    let core = [];
    Object.entries(examsData).forEach(([examNum, examQuestions]) => {
        if (!isBritizenExam(examNum)) {
            core = core.concat(examQuestions);
        }
    });
    return core;
}

function startExam(examNum) {
    currentExam = examNum;
    isMarathon = false;
    isFailedReview = false;
    setupQuiz(shuffle(examsData[examNum]), getExamLabel(examNum));
}

function startRandomExam() {
    currentExam = 'Random';
    isMarathon = false;
    isFailedReview = false;
    const all = getCoreQuestions();
    const randomSelection = shuffle(all).slice(0, 24);
    setupQuiz(randomSelection, 'Random Exam');
}

function startMarathon() {
    currentExam = 'Marathon';
    isMarathon = true;
    isFailedReview = false;
    const all = getCoreQuestions();
    setupQuiz(shuffle(all), 'Marathon Exam');
}

function getFailedQuizQuestions() {
    return allFailedQuestions
        .map(item => item.quizQuestion)
        .filter(question => !isBritizenQuestion(question))
        .filter(Boolean);
}

function getFailedQuestionsByAttention() {
    return getFailedQuizQuestions().sort((a, b) => {
        const aStats = questionStats[getQuestionKey(a)] || { answered: 0, correct: 0 };
        const bStats = questionStats[getQuestionKey(b)] || { answered: 0, correct: 0 };
        const aFailureRate = aStats.answered ? (aStats.answered - aStats.correct) / aStats.answered : 0;
        const bFailureRate = bStats.answered ? (bStats.answered - bStats.correct) / bStats.answered : 0;

        if (bFailureRate !== aFailureRate) return bFailureRate - aFailureRate;
        return (bStats.answered - bStats.correct) - (aStats.answered - aStats.correct);
    });
}

function startFailedQuestionsReview(mode = 'all') {
    const failedQuestions = allFailedQuestions
        .map(item => item.quizQuestion)
        .filter(Boolean);

    if (failedQuestions.length === 0) {
        switchHomeTab('failed');
        renderFailedQuestionsHome();
        return;
    }

    isMarathon = false;
    isFailedReview = true;

    if (mode === 'exam') {
        currentExam = 'Failed Questions Exam';
        setupQuiz(shuffle(failedQuestions).slice(0, 24), 'Failed Questions Exam');
    } else if (mode === 'attention') {
        currentExam = 'Most Attention';
        setupQuiz(getFailedQuestionsByAttention().slice(0, 24), 'Most Attention');
    } else {
        currentExam = 'All Failed Questions';
        setupQuiz(shuffle(failedQuestions), 'All Failed Questions');
    }
}

function startSingleQuestionReview(question) {
    currentExam = 'Question Review';
    isMarathon = false;
    isFailedReview = false;
    setupQuiz([question], 'Question Review');
}

function setupQuiz(questions, subtitleText) {
    clearInterval(timerInterval);
    currentQuestions = questions;
    currentQuestionIndex = 0;
    score = 0;
    wrongQuestions = [];
    
    homeView.classList.add('hidden');
    resultView.classList.add('hidden');
    quizView.classList.remove('hidden');
    homeBtn.classList.remove('hidden');
    
    if (isMarathon) {
        stopBtn.classList.remove('hidden');
        timerDisplay.classList.add('hidden');
    } else {
        stopBtn.classList.add('hidden');
        startTimer();
    }
    
    subtitle.textContent = subtitleText;
    subtitle.classList.remove('hidden');
    renderQuestion();
}

function startTimer() {
    timeLeft = EXAM_TIME_LIMIT;
    startTime = Date.now();
    timerDisplay.classList.remove('hidden');
    timerDisplay.classList.remove('warning');
    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 60) {
            timerDisplay.classList.add('warning');
        }

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            showResults(true);
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60);
    const secs = timeLeft % 60;
    timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function renderQuestion() {
    const question = currentQuestions[currentQuestionIndex];
    const shuffledAnswers = shuffle(question.answers);
    
    progress.textContent = `Question ${currentQuestionIndex + 1} of ${currentQuestions.length}`;
    questionText.textContent = question.question;
    answersContainer.innerHTML = '';
    
    feedbackContainer.classList.add('hidden');
    checkBtn.classList.remove('hidden');
    checkBtn.disabled = true;
    nextBtn.classList.add('hidden');

    const correctCount = question.answers.filter(a => a.isCorrect).length;
    const inputType = correctCount > 1 ? 'checkbox' : 'radio';

    shuffledAnswers.forEach((ans, idx) => {
        const label = document.createElement('label');
        label.className = 'answer-option';
        
        const input = document.createElement('input');
        input.type = inputType;
        input.name = 'answer';
        input.value = idx;
        input.dataset.isCorrect = ans.isCorrect;
        
        input.onchange = () => {
            const checked = answersContainer.querySelectorAll('input:checked');
            checkBtn.disabled = checked.length === 0;
            
            answersContainer.querySelectorAll('.answer-option').forEach(l => l.classList.remove('selected'));
            checked.forEach(c => c.parentElement.classList.add('selected'));
        };

        label.appendChild(input);
        label.appendChild(document.createTextNode(ans.text));
        answersContainer.appendChild(label);
    });
}

function checkAnswer() {
    const question = currentQuestions[currentQuestionIndex];
    const inputs = answersContainer.querySelectorAll('input');
    let allCorrect = true;
    let anyWrong = false;

    inputs.forEach(input => {
        const isCorrect = input.dataset.isCorrect === 'true';
        const isChecked = input.checked;
        const label = input.parentElement;

        if (isCorrect) {
            label.classList.add('correct');
            if (!isChecked) allCorrect = false;
        } else {
            if (isChecked) {
                label.classList.add('incorrect');
                anyWrong = true;
            }
        }
        input.disabled = true;
    });

    const success = allCorrect && !anyWrong;
    recordQuestionAttempt(question, success);

    if (success) {
        score++;
    } else {
        wrongQuestions.push({
            id: question.id,
            question: question.question,
            correctAnswer: question.answers.filter(a => a.isCorrect).map(a => a.text).join(', '),
            explanation: question.reference,
            quizQuestion: question
        });
    }

    resultStatus.textContent = success ? '✅ Correct!' : '❌ Incorrect';
    resultStatus.style.color = success ? 'var(--success-color)' : 'var(--danger-color)';
    explanationText.textContent = question.reference || 'No explanation available.';
    
    feedbackContainer.classList.remove('hidden');
    checkBtn.classList.add('hidden');
    nextBtn.classList.remove('hidden');
    
    feedbackContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function nextQuestion() {
    currentQuestionIndex++;
    if (currentQuestionIndex < currentQuestions.length) {
        renderQuestion();
        window.scrollTo(0, 0);
    } else {
        showResults();
    }
}

function showResults(isTimeUp = false) {
    clearInterval(timerInterval);
    quizView.classList.add('hidden');
    homeBtn.classList.remove('hidden');
    stopBtn.classList.add('hidden');
    timerDisplay.classList.add('hidden');
    resultView.classList.remove('hidden');
    
    subtitle.textContent = 'Results';
    subtitle.classList.remove('hidden');

    if (isTimeUp) {
        timeUpMsg.classList.remove('hidden');
    } else {
        timeUpMsg.classList.add('hidden');
    }
    
    const finalTotal = isMarathon ? (score + wrongQuestions.length) : currentQuestions.length;
    
    const percentage = Math.round((score / finalTotal) * 100) || 0;
    
    scoreText.textContent = `Your Score: ${score}/${finalTotal}`;
    scorePercentage.textContent = `${percentage}%`;

    if (!isMarathon) {
        const timeSpent = Math.floor((Date.now() - startTime) / 1000);
        const spentMins = Math.floor(timeSpent / 60);
        const spentSecs = timeSpent % 60;
        timeTakenText.textContent = `Time Taken: ${spentMins.toString().padStart(2, '0')}:${spentSecs.toString().padStart(2, '0')}`;
        timeTakenText.classList.remove('hidden');
    } else {
        timeTakenText.classList.add('hidden');
    }
    
    if (wrongQuestions.length > 0) {
        wrongAnswersContainer.classList.remove('hidden');
        wrongAnswersList.innerHTML = '';
        wrongQuestions.forEach(item => {
            const div = document.createElement('div');
            div.className = 'wrong-item';
            div.innerHTML = `
                <div class="wrong-question">${item.question}</div>
                <div class="correct-answer-was">Correct: ${item.correctAnswer}</div>
                <div class="wrong-explanation">${item.explanation || ''}</div>
            `;
            wrongAnswersList.appendChild(div);
        });
    } else {
        wrongAnswersContainer.classList.add('hidden');
    }
    
    // Store failed questions to persistent list
    storeFailedQuestions();
    
    window.scrollTo(0, 0);
}

function storeFailedQuestions() {
    if (isFailedReview) {
        const reviewedKeys = new Set(currentQuestions.map(getQuestionKey));
        allFailedQuestions = allFailedQuestions.filter(item => !reviewedKeys.has(getQuestionKey(item.quizQuestion)));
    }

    const coreWrongQuestions = wrongQuestions.filter(item => !isBritizenQuestion(item.quizQuestion));

    if (coreWrongQuestions.length > 0) {
        const failedByKey = new Map(allFailedQuestions.map(item => [getQuestionKey(item.quizQuestion), item]));
        coreWrongQuestions.forEach(item => {
            failedByKey.set(getQuestionKey(item.quizQuestion), {
                ...item,
                lastFailedAt: new Date().toISOString()
            });
        });
        allFailedQuestions = Array.from(failedByKey.values());
    }

    saveFailedQuestions();
    renderFailedQuestionsHome();
}

function getQuestionKey(question) {
    if (!question) return '';
    return question.historyKey || `text:${question.question}`;
}

function findQuestionInBank(question) {
    if (!question) return null;

    return getAllQuestions().find(candidate => {
        const sameText = candidate.question === question.question;
        const sameId = String(candidate.id || '') === String(question.id || '');
        return sameText && sameId;
    }) || getAllQuestions().find(candidate => candidate.question === question.question) || null;
}

function getKnownQuestionKeys() {
    return new Set(getCoreQuestions().map(getQuestionKey));
}

function normalizeHistoryForQuestionBank() {
    const knownQuestionKeys = getKnownQuestionKeys();
    questionStats = Object.entries(questionStats).reduce((stats, [key, value]) => {
        if (knownQuestionKeys.has(key)) {
            stats[key] = value;
        }
        return stats;
    }, {});

    allFailedQuestions = allFailedQuestions.filter(item => knownQuestionKeys.has(getQuestionKey(item.quizQuestion)));
    saveQuestionStats();
    saveFailedQuestions();
}

function getHistoryPayload() {
    return {
        questionStats,
        failedQuestions: allFailedQuestions,
        updatedAt: new Date().toISOString()
    };
}

function getMostRecentDate(first, second) {
    if (!first) return second || null;
    if (!second) return first;
    return new Date(first) > new Date(second) ? first : second;
}

function mergeQuestionStats(localStats, serverStats) {
    const merged = { ...localStats };

    Object.entries(serverStats || {}).forEach(([key, serverValue]) => {
        const localValue = merged[key] || { answered: 0, correct: 0, lastAnsweredAt: null };
        const answered = Math.max(Number(localValue.answered) || 0, Number(serverValue.answered) || 0);
        const correct = Math.min(
            answered,
            Math.max(Number(localValue.correct) || 0, Number(serverValue.correct) || 0)
        );

        merged[key] = {
            answered,
            correct,
            lastAnsweredAt: getMostRecentDate(localValue.lastAnsweredAt, serverValue.lastAnsweredAt)
        };
    });

    return merged;
}

function mergeFailedQuestions(localFailedQuestions, serverFailedQuestions) {
    const failedByKey = new Map();

    [...(serverFailedQuestions || []), ...(localFailedQuestions || [])].forEach(item => {
        const quizQuestion = findQuestionInBank(item.quizQuestion || item) || item.quizQuestion || item;
        if (!quizQuestion || !quizQuestion.question || !Array.isArray(quizQuestion.answers)) return;

        const key = getQuestionKey(quizQuestion);
        const existing = failedByKey.get(key);
        if (!existing || new Date(item.lastFailedAt || 0) >= new Date(existing.lastFailedAt || 0)) {
            failedByKey.set(key, {
                id: quizQuestion.id,
                question: item.question || quizQuestion.question,
                correctAnswer: item.correctAnswer || quizQuestion.answers.filter(a => a.isCorrect).map(a => a.text).join(', '),
                explanation: item.explanation || quizQuestion.reference,
                quizQuestion,
                lastFailedAt: item.lastFailedAt
            });
        }
    });

    return Array.from(failedByKey.values());
}

async function syncHistoryFromServer() {
    try {
        const response = await fetch(HISTORY_API_URL);
        if (!response.ok) return;

        const serverHistory = await response.json();
        questionStats = mergeQuestionStats(questionStats, serverHistory.questionStats);
        allFailedQuestions = mergeFailedQuestions(allFailedQuestions, serverHistory.failedQuestions);
        saveQuestionStats();
        saveFailedQuestions();
    } catch (error) {
        console.info('Server history is unavailable; using local history only.');
    }
}

async function saveHistoryToServer() {
    try {
        await fetch(HISTORY_API_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(getHistoryPayload())
        });
    } catch (error) {
        console.info('Server history save failed; local history is still saved.');
    }
}

function loadQuestionStats() {
    try {
        const stored = JSON.parse(localStorage.getItem('questionStats') || '{}');
        if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};

        return Object.entries(stored).reduce((stats, [key, value]) => {
            const answered = Number(value.answered) || 0;
            const correct = Number(value.correct) || 0;
            if (answered < 0 || correct < 0) return stats;

            stats[key] = {
                answered,
                correct: Math.min(correct, answered),
                lastAnsweredAt: value.lastAnsweredAt || null
            };
            return stats;
        }, {});
    } catch (error) {
        console.warn('Failed to load saved question stats:', error);
        return {};
    }
}

function saveQuestionStats() {
    localStorage.setItem('questionStats', JSON.stringify(questionStats));
    saveHistoryToServer();
}

function recordQuestionAttempt(question, success) {
    const key = getQuestionKey(question);
    const stats = questionStats[key] || { answered: 0, correct: 0, lastAnsweredAt: null };

    stats.answered++;
    if (success) stats.correct++;
    stats.lastAnsweredAt = new Date().toISOString();

    questionStats[key] = stats;
    saveQuestionStats();
    renderMasteryProgress();
}

function getQuestionStatus(stats) {
    if (!stats || stats.answered === 0) {
        return { label: 'Unseen', className: 'unseen' };
    }

    const accuracy = stats.correct / stats.answered;
    if (stats.answered >= 3 && accuracy >= 0.85) {
        return { label: 'Strong', className: 'strong' };
    }
    if (accuracy >= 0.6) {
        return { label: 'Building', className: 'building' };
    }
    return { label: 'Needs practice', className: 'needs-practice' };
}

function getQuestionMastery(stats) {
    if (!stats || stats.answered === 0) return 0;

    const accuracy = stats.correct / stats.answered;
    const practiceDepth = Math.min(stats.answered, 3) / 3;
    return accuracy * practiceDepth;
}

function renderMasteryProgress() {
    if (!masteryProgressSummary || !masteryProgressPercent || !masteryProgressFill || !masteryProgressInsights) return;

    const questions = getCoreQuestions();
    const totalQuestions = questions.length;
    const rows = questions.map(question => {
        const stats = questionStats[getQuestionKey(question)] || { answered: 0, correct: 0 };
        return { stats, mastery: getQuestionMastery(stats) };
    });
    const answeredQuestions = rows.filter(row => row.stats.answered > 0).length;
    const perfectedQuestions = rows.filter(row => row.stats.answered >= 3 && row.stats.correct === row.stats.answered).length;
    const totalAttempts = rows.reduce((sum, row) => sum + row.stats.answered, 0);
    const totalCorrect = rows.reduce((sum, row) => sum + row.stats.correct, 0);
    const overallAccuracy = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
    const masteryPercent = totalQuestions
        ? Math.round((rows.reduce((sum, row) => sum + row.mastery, 0) / totalQuestions) * 100)
        : 0;

    masteryProgressSummary.textContent = `${perfectedQuestions}/${totalQuestions} questions perfected`;
    masteryProgressPercent.textContent = `${masteryPercent}%`;
    masteryProgressFill.style.width = `${masteryPercent}%`;

    masteryProgressInsights.innerHTML = '';
    [
        { label: 'Seen', value: `${answeredQuestions}/${totalQuestions}` },
        { label: 'Accuracy', value: `${overallAccuracy}%` },
        { label: 'Attempts', value: totalAttempts }
    ].forEach(item => {
        const insight = document.createElement('div');
        insight.className = 'mastery-progress-insight';

        const value = document.createElement('strong');
        value.textContent = item.value;

        const label = document.createElement('span');
        label.textContent = item.label;

        insight.append(value, label);
        masteryProgressInsights.appendChild(insight);
    });
}

function getAttentionScore(stats) {
    if (!stats || stats.answered === 0) return 0;

    const wrongAnswers = stats.answered - stats.correct;
    const accuracyPenalty = 1 - (stats.correct / stats.answered);

    return (wrongAnswers * 100) + Math.round(accuracyPenalty * 100);
}

function getDashboardQuestions(questions) {
    const filter = questionStatsFilter ? questionStatsFilter.value : 'needs-attention';
    const rows = questions.map((question, index) => {
        const stats = questionStats[getQuestionKey(question)] || { answered: 0, correct: 0 };
        const status = getQuestionStatus(stats);
        return {
            question,
            stats,
            status,
            originalIndex: index,
            attentionScore: getAttentionScore(stats)
        };
    });

    return rows
        .filter(row => {
            if (filter === 'needs-practice') return row.status.className === 'needs-practice';
            if (filter === 'attempted') return row.stats.answered > 0;
            if (filter === 'unseen') return row.stats.answered === 0;
            return true;
        })
        .sort((a, b) => {
            if (filter === 'needs-attention' || filter === 'needs-practice' || filter === 'attempted') {
                if (b.attentionScore !== a.attentionScore) return b.attentionScore - a.attentionScore;
                if (b.stats.answered !== a.stats.answered) return b.stats.answered - a.stats.answered;
            }
            return a.originalIndex - b.originalIndex;
        });
}

function renderQuestionDashboard() {
    if (!dashboardSummary || !dashboardMetrics || !questionStatsList) return;

    const questions = getCoreQuestions();
    const totalQuestions = questions.length;
    const statRows = questions.map(question => {
        const stats = questionStats[getQuestionKey(question)];
        return stats || { answered: 0, correct: 0 };
    });
    const answeredQuestions = statRows.filter(stats => stats.answered > 0).length;
    const totalAttempts = statRows.reduce((sum, stats) => sum + stats.answered, 0);
    const totalCorrect = statRows.reduce((sum, stats) => sum + stats.correct, 0);
    const overallAccuracy = totalAttempts ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    dashboardSummary.textContent = `${answeredQuestions}/${totalQuestions} questions answered at least once`;

    dashboardMetrics.innerHTML = '';
    [
        { label: 'Answered', value: `${answeredQuestions}/${totalQuestions}` },
        { label: 'Attempts', value: totalAttempts },
        { label: 'Correct', value: totalCorrect },
        { label: 'Accuracy', value: `${overallAccuracy}%` }
    ].forEach(metric => {
        const item = document.createElement('div');
        item.className = 'dashboard-metric';

        const value = document.createElement('strong');
        value.textContent = metric.value;

        const label = document.createElement('span');
        label.textContent = metric.label;

        item.append(value, label);
        dashboardMetrics.appendChild(item);
    });

    const dashboardRows = getDashboardQuestions(questions);

    questionStatsList.innerHTML = '';
    if (dashboardRows.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'question-stats-empty';
        empty.textContent = 'No questions match this filter yet.';
        questionStatsList.appendChild(empty);
        return;
    }

    dashboardRows.forEach(({ question, stats, status }) => {
        const accuracy = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : 0;

        const row = document.createElement('article');
        row.className = 'question-stat-row';

        const top = document.createElement('div');
        top.className = 'question-stat-top';

        const title = document.createElement('h3');
        title.textContent = question.question;

        const badge = document.createElement('span');
        badge.className = `status-badge ${status.className}`;
        badge.textContent = status.label;

        top.append(title, badge);

        const details = document.createElement('div');
        details.className = 'question-stat-details';
        details.textContent = `${stats.answered} answered | ${stats.correct} correct | ${accuracy}%`;

        const bar = document.createElement('div');
        bar.className = 'accuracy-track';
        bar.setAttribute('aria-label', `Accuracy ${accuracy}%`);

        const fill = document.createElement('div');
        fill.className = 'accuracy-fill';
        fill.style.width = `${accuracy}%`;

        const retakeBtn = document.createElement('button');
        retakeBtn.className = 'retake-question-btn';
        retakeBtn.type = 'button';
        retakeBtn.textContent = 'Retake';
        retakeBtn.onclick = () => startSingleQuestionReview(question);

        bar.appendChild(fill);
        row.append(top, details, bar, retakeBtn);
        questionStatsList.appendChild(row);
    });
}

function loadFailedQuestions() {
    try {
        const stored = JSON.parse(localStorage.getItem('failedQuestions') || '[]');
        if (!Array.isArray(stored)) return [];

        const failedByKey = new Map();
        stored.forEach(item => {
            const quizQuestion = findQuestionInBank(item.quizQuestion || item) || item.quizQuestion || item;
            if (!quizQuestion || !quizQuestion.question || !Array.isArray(quizQuestion.answers)) return;

            const failedItem = {
                id: quizQuestion.id,
                question: item.question || quizQuestion.question,
                correctAnswer: item.correctAnswer || quizQuestion.answers.filter(a => a.isCorrect).map(a => a.text).join(', '),
                explanation: item.explanation || quizQuestion.reference,
                quizQuestion,
                lastFailedAt: item.lastFailedAt
            };
            failedByKey.set(getQuestionKey(quizQuestion), failedItem);
        });

        return Array.from(failedByKey.values());
    } catch (error) {
        console.warn('Failed to load saved failed questions:', error);
        return [];
    }
}

function saveFailedQuestions() {
    localStorage.setItem('failedQuestions', JSON.stringify(allFailedQuestions));
    saveHistoryToServer();
}

function renderFailedQuestionsHome() {
    if (!failedQuestionsSection || !failedQuestionsCount || !failedQuestionsList) return;

    const visibleFailedQuestions = allFailedQuestions.filter(item => !isBritizenQuestion(item.quizQuestion));
    const count = visibleFailedQuestions.length;
    const failedActionButtons = [retakeFailedExamBtn, retakeFailedAttentionBtn, retakeFailedAllBtn].filter(Boolean);
    failedQuestionsCount.textContent = `${count} saved question${count === 1 ? '' : 's'}`;
    failedQuestionsList.innerHTML = '';
    failedQuestionsSection.classList.remove('hidden');

    if (count === 0) {
        const empty = document.createElement('div');
        empty.className = 'failed-question-empty';
        empty.textContent = 'No failed questions saved yet.';
        failedQuestionsList.appendChild(empty);
        failedActionButtons.forEach(button => button.disabled = true);
        clearFailedQuestionsBtn.disabled = true;
        return;
    }

    failedActionButtons.forEach(button => button.disabled = false);
    clearFailedQuestionsBtn.disabled = false;
    visibleFailedQuestions.slice(0, 5).forEach(item => {
        const div = document.createElement('div');
        div.className = 'failed-question-preview';
        div.textContent = item.question;
        failedQuestionsList.appendChild(div);
    });

    if (count > 5) {
        const extra = document.createElement('div');
        extra.className = 'failed-question-extra';
        extra.textContent = `+ ${count - 5} more`;
        failedQuestionsList.appendChild(extra);
    }
}

function clearFailedQuestions() {
    allFailedQuestions = [];
    saveFailedQuestions();
    renderFailedQuestionsHome();
}

function clearQuestionStats() {
    questionStats = {};
    saveQuestionStats();
    renderMasteryProgress();
    renderQuestionDashboard();
}

function goHome() {
    clearInterval(timerInterval);
    homeView.classList.remove('hidden');
    quizView.classList.add('hidden');
    resultView.classList.add('hidden');
    homeBtn.classList.add('hidden');
    stopBtn.classList.add('hidden');
    timerDisplay.classList.add('hidden');
    
    subtitle.textContent = '';
    subtitle.classList.add('hidden');
    renderMasteryProgress();
    renderQuestionDashboard();
    renderFailedQuestionsHome();
    
    window.scrollTo(0, 0);
}

function restartExam() {
    if (currentExam === 'Random') {
        startRandomExam();
    } else if (currentExam === 'Marathon') {
        startMarathon();
    } else if (currentExam === 'Failed Questions Exam') {
        startFailedQuestionsReview('exam');
    } else if (currentExam === 'Most Attention') {
        startFailedQuestionsReview('attention');
    } else if (currentExam === 'All Failed Questions') {
        startFailedQuestionsReview('all');
    } else if (currentExam === 'Question Review') {
        setupQuiz(currentQuestions, 'Question Review');
    } else {
        startExam(currentExam);
    }
}

// Event Listeners
checkBtn.onclick = checkAnswer;
nextBtn.onclick = nextQuestion;
homeBtn.onclick = goHome;
stopBtn.onclick = () => showResults();
randomExamBtn.onclick = startRandomExam;
marathonBtn.onclick = startMarathon;
retakeFailedExamBtn.onclick = () => startFailedQuestionsReview('exam');
retakeFailedAttentionBtn.onclick = () => startFailedQuestionsReview('attention');
retakeFailedAllBtn.onclick = () => startFailedQuestionsReview('all');
clearFailedQuestionsBtn.onclick = clearFailedQuestions;
if (questionStatsFilter) {
    questionStatsFilter.onchange = renderQuestionDashboard;
}
clearQuestionStatsBtn.onclick = clearQuestionStats;
restartBtn.onclick = restartExam;
resultHomeBtn.onclick = goHome;
homeTabs.forEach(tab => {
    tab.onclick = () => {
        const tabName = tab.id.replace('-tab-btn', '');
        switchHomeTab(tabName);
        if (tabName === 'stats') renderQuestionDashboard();
        if (tabName === 'failed') renderFailedQuestionsHome();
    };
});

// Start the app
init();
