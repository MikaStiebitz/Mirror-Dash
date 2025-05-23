export class GameTimer {
    constructor(scene) {
        this.scene = scene;
        this.timeLeft = 180; // in seconds
        this.timerEvent = null;
        this.gameUI = null;
        this.syncing = false; // Flag to prevent sync loops
    }

    init(scene) {
        this.scene = scene;
        this.timeLeft = 180; // in seconds
        this.timerEvent = null;
        this.gameUI = null;
        this.syncing = false; // Flag to prevent sync loops
    }

    setGameUI(gameUI) {
        this.gameUI = gameUI;
    }

    setLevelMusic(levelMusic) {
        this.levelMusic = levelMusic;
    }

    startTimer() {
        // RESET timer to full duration - this is the most important part
        this.timeLeft = 180; // Reset to default level time (3 minutes)

        // Reset syncing flag
        this.syncing = false;

        // Remove any previous timer event if exists
        if (this.timerEvent) {
            this.timerEvent.remove(false);
        }

        // Create the countdown timer event
        this.timerEvent = this.scene.time.addEvent({
            delay: 1000, // 1 second
            callback: this.updateTimer,
            callbackScope: this,
            loop: true,
        });

        // Set up timer sync listener if not already set
        this.setupTimerSync();

        // Force timer update on UI immediately
        if (this.gameUI) {
            this.gameUI.updateTimer(this.timeLeft);
        }

        // Broadcast initial timer reset to all players in the lobby
        if (this.scene.socket && this.scene.socket.connected && this.scene.lobbyId) {
            this.scene.socket.emit("resetTimer", {
                lobbyId: this.scene.lobbyId,
                timeLeft: this.timeLeft,
            });
        }

        return this.timerEvent;
    }

    setupTimerSync() {
        // Only set up listener if we have a socket and it hasn't been set up already
        if (this.scene.socket && !this.syncListenerActive) {
            this.syncListenerActive = true;

            // Listen for timer sync events from the server
            this.scene.socket.on("timerSync", data => {
                if (!this.syncing && data && typeof data.timeLeft === "number") {
                    this.syncing = true;

                    // Only update if the difference is significant (more than 2 seconds)
                    // This prevents minor adjustments that could feel jerky
                    if (Math.abs(this.timeLeft - data.timeLeft) > 2) {
                        console.log(`Syncing timer: local=${this.timeLeft}, server=${data.timeLeft}`);
                        this.timeLeft = data.timeLeft;

                        // Update UI immediately
                        if (this.gameUI) {
                            this.gameUI.updateTimer(this.timeLeft);
                        }
                    }

                    this.syncing = false;
                }
            });

            // Request initial timer sync
            if (this.scene.lobbyId) {
                this.scene.socket.emit("requestTimerSync", {
                    lobbyId: this.scene.lobbyId,
                });
            }
        }
    }

    updateTimer() {
        if (typeof this.timeLeft === "number") {
            this.timeLeft = Math.max(0, this.timeLeft - 1);

            // Update UI if available
            if (this.gameUI) {
                this.gameUI.updateTimer(this.timeLeft);
            }

            // Sync timer with other players periodically (every 5 seconds)
            if (
                !this.syncing &&
                this.scene.socket &&
                this.scene.socket.connected &&
                this.scene.lobbyId &&
                this.timeLeft % 5 === 0
            ) {
                this.syncing = true;
                this.scene.socket.emit("updateTimer", {
                    lobbyId: this.scene.lobbyId,
                    timeLeft: this.timeLeft,
                });
                this.syncing = false;
            }

            if (this.timeLeft <= 0) {
                this.onTimerEnd();
                if (this.timerEvent) {
                    this.timerEvent.remove(); // Stop the timer
                }
            }
        }
    }

    onTimerEnd() {
        console.log("Timer finished!");

        // Use the shared game over handler if available
        if (this.scene.handleGameOver) {
            this.scene.handleGameOver("timeout");
        } else {
            // Fade out and stop music if it exists (fallback logic)
            if (this.levelMusic) {
                this.scene.tweens.add({
                    targets: this.levelMusic,
                    volume: 0,
                    duration: 1000,
                    onComplete: () => {
                        this.levelMusic.stop();

                        // Now switch to GameOver scene after fade completes
                        this.scene.scene.start("GameOver", {
                            levelId: this.scene.levelId,
                            playerName: this.scene.playerName,
                            socket: this.scene.socket,
                        });
                    },
                });
            } else {
                // No music to fade, switch immediately
                this.scene.scene.start("GameOver", {
                    levelId: this.scene.levelId,
                    playerName: this.scene.playerName,
                    socket: this.scene.socket,
                });
            }
        }
    }

    applyPenalty(seconds = 5) {
        if (typeof this.timeLeft === "number") {
            const penalty = this.scene.instantDeathMode ? this.timeLeft : seconds;
            this.timeLeft = Math.max(0, this.timeLeft - penalty);

            // Update UI immediately
            if (this.gameUI) {
                this.gameUI.updateTimer(this.timeLeft);
            }

            // Sync the penalty with other players
            if (this.scene.socket && this.scene.socket.connected && this.scene.lobbyId) {
                this.scene.socket.emit("updateTimer", {
                    lobbyId: this.scene.lobbyId,
                    timeLeft: this.timeLeft,
                    isPenalty: true,
                });
            }
        }
    }

    applyDistancePenalty() {
        if (typeof this.timeLeft === "number") {
            const otherPlayerIds = Object.keys(this.scene.otherPlayers);
            const otherPlayer = this.scene.otherPlayers[otherPlayerIds[0]];
            if (!otherPlayer) return;

            // Calculate positions for top view
            const startX = this.scene.player.x;
            const startY = this.scene.player.y;
            const endX = otherPlayer.x;
            const endY = otherPlayer.y;

            // Calculate the distance between players
            const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
            const penalty = distance / 100000;
            this.timeLeft = Math.max(0, this.timeLeft - penalty);

            // Update UI immediately
            if (this.gameUI) {
                this.gameUI.updateTimer(Math.round(this.timeLeft));
            }

            // Sync the penalty with other players
            if (this.scene.socket && this.scene.socket.connected && this.scene.lobbyId) {
                this.scene.socket.emit("updateTimer", {
                    lobbyId: this.scene.lobbyId,
                    timeLeft: this.timeLeft,
                    isPenalty: true,
                });
            }
        }
    }

    getTimeLeft() {
        return this.timeLeft;
    }

    shutdown() {
        if (this.timerEvent) {
            this.timerEvent.remove(false);
            this.timerEvent = null;
        }

        // Remove socket listeners to prevent memory leaks
        if (this.scene.socket) {
            this.scene.socket.off("timerSync");
        }

        this.syncListenerActive = false;
    }
}
