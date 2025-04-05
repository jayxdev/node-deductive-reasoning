let score = 0;
let maxScore = 0;
let currentAns;
let userName = '';
let timeLeft = 120;
let wrongCount = 0;
let timerInterval;
let gameStarted = false;
let currentGridSize = 3;
let canAnswer = true;

const correctSound = document.getElementById('correctSound');
const wrongSound = document.getElementById('wrongSound');
const gameStartSound = document.getElementById('gameStartSound');
const gameOverSound = document.getElementById('gameOverSound');
const timerWarningSound = document.getElementById('timerWarningSound');
const timerCountdownSound = document.getElementById('timerCountdownSound');

function playSound(soundElement) {
    soundElement.play().catch(error => console.error(`Failed to play ${soundElement.id}:`, error));
}

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 120;
    const timerDisplay = document.getElementById('timerDisplay');
    timerInterval = setInterval(() => {
        if (timeLeft >0) {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            timerDisplay.textContent = timeString;
            if (timeLeft <= 30) {
                timerDisplay.classList.add('warning');
                if (timeLeft <= 30 && timeLeft >= 27) playSound(timerWarningSound); // Play twice at 30s
                if (timeLeft <= 10 && timeLeft > 0) playSound(timerCountdownSound); // Every second for last 10s
            } else {
                timerDisplay.classList.remove('warning');
            }
        } else {
            clearInterval(timerInterval);
            playSound(gameOverSound);
            endGame('Time Up!');
            
        }
    }, 1000);
}

function showCountdown(callback) {
    const modal = document.getElementById('countdownModal');
    const countdown = document.getElementById('countdown');
    let count = 3;
    modal.style.display = 'flex';
    countdown.textContent = count;
    const interval = setInterval(() => {
        if (count > 0) {
            countdown.textContent = count;
            playSound(gameStartSound);
        }
        if (count === 0) {
            countdown.textContent = 'Go!';
            playSound(timerWarningSound);
        }
        if (count < 0) {
            clearInterval(interval);
            modal.style.display = 'none';
            callback();
        }
        count--;
    }, 1000);
}

function endGame(reason) {
    clearInterval(timerInterval);
    gameStarted = false;
    canAnswer = false;
    const modal = document.getElementById('gameOverModal');
    const message = document.getElementById('finalScoreMessage');
    message.textContent = `${reason} Your Final Score: ${score}`;
    modal.style.display = 'flex';
    document.getElementById('gridSize').disabled = false;
    document.getElementById('gridSize').value = 3;
    currentGridSize = 3;
    document.getElementById('startGame').textContent = 'Start Game';
    document.getElementById('timerDisplay').classList.remove('warning');
    document.getElementById('timerDisplay').textContent = '2:00';
    document.getElementById('wrongCountDisplay').style.display = 'none';
    updateLeaderboard();
    fetchNewGame();
}

function fetchNewGame() {
    const size = currentGridSize;
    const grid = document.getElementById('grid');
    const options = document.getElementById('options');
    grid.classList.add('fade');
    options.classList.add('fade');
    setTimeout(() => {
        fetch(`/new-game?size=${size}`)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then(data => {
                displayGrid(data.puzzleGrid);
                displayOptions(data.shapes, data.ans);
                currentAns = data.ans;
                canAnswer = true;
                grid.classList.remove('fade');
                options.classList.remove('fade');
            })
            .catch(error => console.error('Error fetching new game:', error));
    }, 500);
}

function displayGrid(gridData) {
    const gridDiv = document.getElementById('grid');
    gridDiv.innerHTML = '';
    gridData.forEach(row => {
        const rowDiv = document.createElement('div');
        row.forEach(cell => {
            const button = document.createElement('button');
            button.textContent = cell;
            button.className = cell === '‎' ? 'grid-cell empty-cell' : 'grid-cell';
            button.disabled = true;
            rowDiv.appendChild(button);
        });
        gridDiv.appendChild(rowDiv);
    });
}

function displayOptions(shapes, ans) {
    const shapeButtonsDiv = document.getElementById('shapeButtons');
    shapeButtonsDiv.innerHTML = '';
    shapes.forEach(shape => {
        const button = document.createElement('button');
        button.textContent = shape;
        button.className = 'shape-button';
        button.addEventListener('click', () => checkAnswer(shape, ans));
        shapeButtonsDiv.appendChild(button);
    });
}

function checkAnswer(selectedShape, ans) {
    if (!canAnswer) return;
    canAnswer = false;
    const messageDiv = document.getElementById('message');
    messageDiv.style.opacity = '1';
    if (selectedShape === ans) {
        messageDiv.textContent = 'Correct! ✅';
        messageDiv.className = 'message success';
        playSound(correctSound);
        if (gameStarted) {
            score += 1;
            maxScore = Math.max(score, maxScore);
        }
    } else {
        messageDiv.textContent = `Wrong! Correct shape was ${ans}.`;
        messageDiv.className = 'message gerror';
        playSound(wrongSound);
        if (gameStarted) {
            wrongCount += 1;
            document.getElementById('wrongCount').textContent = wrongCount;
            if (wrongCount >= 3) {
                endGame('Too Many Wrong Answers!');
                return;
            }
        }
    }
    updateScore();
    setTimeout(() => {
        messageDiv.style.opacity = '0';
        setTimeout(fetchNewGame, 500);
    }, 1500);
}

function updateScore() {
    document.getElementById('score').textContent = score;
    document.getElementById('maxScore').textContent = maxScore;
    if (gameStarted) adjustGridSize();
}

function adjustGridSize() {
    const gridSizeInput = document.getElementById('gridSize');
    if (score > 5 && gridSizeInput.value < 4) {
        gridSizeInput.value = 4;
        currentGridSize = 4;
    } else if (score > 10 && gridSizeInput.value < 5) {
        gridSizeInput.value = 5;
        currentGridSize = 5;
    }
}

function updateLeaderboard() {
    if (!userName || score === 0) return;
    fetch('/update-leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: userName, score })
    })
    .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('Leaderboard updated successfully:', data.leaderboard);
            displayLeaderboard(data.leaderboard);
            updateCurrentRank(data.leaderboard, userName);
        } else {
            console.error('Leaderboard update failed:', data.error);
        }
    })
    .catch(error => console.error('Error updating leaderboard:', error));
}

function displayLeaderboard(leaderboard) {
    const tbody = document.getElementById('leaderboard').querySelector('tbody');
    tbody.innerHTML = leaderboard.map((entry, i) => 
        `<tr><td>${i + 1}</td><td>${entry.name}</td><td>${entry.score}</td></tr>`
    ).join('');
}

function updateCurrentRank(leaderboard, name) {
    const rank = leaderboard.findIndex(entry => entry.name.toLowerCase() === name.toLowerCase());
    document.getElementById('currentRank').textContent = rank === -1 ? '-' : rank + 1;
}

function isUsernameUnique(name) {
    return fetch('/leaderboard')
        .then(response => {
            if (!response.ok) throw new Error('Leaderboard fetch failed');
            return response.json();
        })
        .then(leaderboard => !leaderboard.some(entry => entry.name.toLowerCase() === name.toLowerCase()))
        .catch(error => {
            console.error('Error checking username:', error);
            return true;
        });
}

function suggestUsername(baseName) {
    let suffix = 1;
    let newName = baseName;
    return new Promise((resolve) => {
        function check() {
            isUsernameUnique(newName).then(isUnique => {
                if (isUnique) {
                    resolve(newName);
                } else {
                    newName = `${baseName}${suffix++}`;
                    check();
                }
            });
        }
        check();
    });
}

function startGame() {
    if (!userName) {
        showAuthModal();
        return;
    }
    const startButton = document.getElementById('startGame');
    if (gameStarted) {
        endGame('Game Restarted');
        setTimeout(() => {
            document.getElementById('gameOverModal').style.display = 'none';
            proceedWithStart();
        }, 500);
        return;
    }
    proceedWithStart();

    function proceedWithStart() {
        showCountdown(() => {
            gameStarted = true;
            score = 0;
            wrongCount = 0;
            currentGridSize = parseInt(document.getElementById('gridSize').value);
            document.getElementById('score').textContent = score;
            document.getElementById('wrongCount').textContent = wrongCount;
            document.getElementById('wrongCountDisplay').style.display = 'block';
            document.getElementById('gridSize').disabled = true;
            startButton.textContent = 'Restart Game';
            startTimer();
            fetchNewGame();
        });
    }
}

function showAuthModal() {
    const authModal = document.getElementById('authModal');
    authModal.style.display = 'flex';
}

function handleLogin() {
    const usernameInput = document.getElementById('loginUsername');
    const errorSpan = document.getElementById('loginError');
    const switchButton = document.getElementById('switchToRegister'); // New reference
    const name = usernameInput.value.trim();
    if (!name) {
        errorSpan.textContent = 'Please enter a username.';
        switchButton.style.display = 'none'; // Hide on empty input
        return;
    }
    fetch('/leaderboard')
        .then(response => response.json())
        .then(leaderboard => {
            if (leaderboard.some(entry => entry.name.toLowerCase() === name.toLowerCase())) {
                userName = name;
                document.getElementById('username').value = userName;
                document.getElementById('loginModal').style.display = 'none';
                fetchNewGame();
            } else {
                errorSpan.textContent = 'Username not found.';
                switchButton.style.display = 'inline-block'; // Show button on failure
            }
        })
        .catch(error => {
            console.error('Error checking login:', error);
            errorSpan.textContent = 'Error occurred. Try again.';
            switchButton.style.display = 'inline-block'; // Show on error too
        });
}

function handleRegister() {
    const usernameInput = document.getElementById('registerUsername');
    const errorSpan = document.getElementById('registerError');
    let name = usernameInput.value.trim();
    if (!name) {
        errorSpan.textContent = 'Please enter a username.';
        return;
    }
    isUsernameUnique(name).then(isUnique => {
        if (isUnique) {
            userName = name;
            document.getElementById('username').value = userName;
            document.getElementById('registerModal').style.display = 'none';
            fetchNewGame();
        } else {
            suggestUsername(name).then(suggestedName => {
                errorSpan.textContent = `Username taken. Try: ${suggestedName}`;
                usernameInput.value = suggestedName;
            });
        }
    });
}

document.getElementById('gridSize').addEventListener('change', () => {
    if (!gameStarted) {
        currentGridSize = parseInt(document.getElementById('gridSize').value);
        fetchNewGame();
    }
});

document.getElementById('startGame').addEventListener('click', startGame);

document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('gameOverModal').style.display = 'none';
});

document.getElementById('burger').addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
});

function closeSidebarOnOutsideClick(event) {
    const sidebar = document.getElementById('sidebar');
    const burger = document.getElementById('burger');
    // Check if sidebar is active and click is outside both sidebar and burger
    if (sidebar.classList.contains('active') && 
        !sidebar.contains(event.target) && 
        !burger.contains(event.target)) {
        sidebar.classList.remove('active');
    }
}

// Add this event listener after existing event listeners, before DOMContentLoaded
document.addEventListener('click', closeSidebarOnOutsideClick);

document.getElementById('loginBtn').addEventListener('click', () => {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('loginModal').style.display = 'flex';
});

document.getElementById('registerBtn').addEventListener('click', () => {
    document.getElementById('authModal').style.display = 'none';
    document.getElementById('registerModal').style.display = 'flex';
});

document.getElementById('submitLogin').addEventListener('click', handleLogin);

document.getElementById('submitRegister').addEventListener('click', handleRegister);

document.getElementById('switchToRegister').addEventListener('click', () => {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('registerModal').style.display = 'flex';
    document.getElementById('loginError').textContent = ''; // Clear error
    document.getElementById('switchToRegister').style.display = 'none'; // Reset button
});

document.addEventListener('DOMContentLoaded', () => {
    fetch('/leaderboard')
        .then(response => {
            if (!response.ok) throw new Error('Initial leaderboard fetch failed');
            return response.json();
        })
        .then(data => {
            console.log('Initial leaderboard:', data);
            displayLeaderboard(data);
        })
        .catch(error => console.error('Error loading leaderboard:', error));
    showAuthModal();
});