export class GameCollisions {
    constructor(scene) {
        this.scene = scene;
    }

    init(scene) {
        this.scene = scene;
    }

    setupCollisions(player, platforms, jumpPads, finishObject, movingPlatforms, spikes, portals) {
        if (!this.scene.physics) return;

        // Add collision between player and platforms
        if (player && player.sprite && platforms) {
            this.scene.physics.add.collider(player.sprite, platforms);
        }

        // Add collision with jump pads and special effect
        if (player && player.sprite && jumpPads) {
            this.scene.physics.add.overlap(player.sprite, jumpPads, this.handleJumpPad, null, this.scene);
        }

        // Set up physics overlap with finish line if it exists
        if (
            player &&
            player.sprite &&
            finishObject &&
            finishObject.getChildren &&
            finishObject.getChildren().length > 0
        ) {
            this.scene.physics.add.overlap(player.sprite, finishObject, this.scene.handleFinish, null, this.scene);
        }

        // Add collision with moving platforms
        if (player && player.sprite && movingPlatforms) {
            const movingPlatformCollision = this.scene.physics.add.collider(
                player.sprite,
                movingPlatforms,
                this.handleMovingPlatformCollision,
                null,
                this
            );
        }

        // Add collision with spikes - with additional check
        if (player && player.sprite && spikes && spikes.getChildren && spikes.getChildren().length > 0) {
            this.scene.physics.add.overlap(player.sprite, spikes, this.handleSpikeCollision, null, this);
        }

        // Add collision with portals
        if (player && player.sprite && portals && portals.getChildren && portals.getChildren().length > 0) {
            this.scene.physics.add.overlap(player.sprite, portals, this.handlePortalCollision, null, this);
        }

        this.movingPlatforms = movingPlatforms;
    }

    setupOtherPlayerCollisions(otherPlayer, platforms, jumpPads, movingPlatforms) {
        if (!this.scene.physics) return;

        // Add collision between other player and platforms
        if (otherPlayer && otherPlayer.sprite && platforms) {
            this.scene.physics.add.collider(otherPlayer.sprite, platforms);

            // Add overlap for jump pads
            if (jumpPads) {
                this.scene.physics.add.overlap(otherPlayer.sprite, jumpPads, this.handleJumpPad, null, this.scene);
            }

            if (this.movingPlatforms) {
                this.scene.physics.add.collider(
                    otherPlayer.sprite,
                    movingPlatforms,
                    this.handleMovingPlatformCollision,
                    null,
                    this
                );
            }
        }
    }

    handleJumpPad(playerSprite, jumpPad) {
        try {
            // Überprüfen, ob der Spieler von oben auf das Jump Pad trifft
            const playerBottom = playerSprite.y + playerSprite.body.height / 2;
            const padTop = jumpPad.y - jumpPad.body.height / 2;
            const isAbove = playerBottom <= padTop + 10;
            const isFalling = playerSprite.body.velocity.y > 0;

            console.log("Handling JumpPad collision", { playerBottom, padTop, isAbove, isFalling });

            if (isAbove) {
                // Setze eine Abklingzeit, um mehrfaches Auslösen zu verhindern
                if (!jumpPad.cooldown) {
                    playerSprite.body.setVelocityY(-5300); // Stärkerer Sprung

                    // Visuelles Feedback für das Jump Pad
                    this.scene.tweens.add({
                        targets: jumpPad,
                        scaleY: 0.8,
                        duration: 100,
                        yoyo: true,
                        ease: "Power1",
                    });

                    // Abklingzeit setzen
                    jumpPad.cooldown = true;
                    this.scene.time.delayedCall(500, () => {
                        jumpPad.cooldown = false;
                    });
                } else {
                    console.warn("JumpPad is on cooldown", { jumpPad });
                }
            } else {
                console.warn("JumpPad conditions not met", { playerBottom, padTop, isAbove, isFalling });
            }
        } catch (error) {
            // console.error("Error in handleJumpPad", error);
        }
    }

    handleSpikeCollision(playerSprite, spike) {
        // Prevent multiple collisions in quick succession
        if (playerSprite.invulnerable) return;

        console.log("Player hit spike - applying time penalty!");

        // Default penalty (increased in instant death mode)
        const penaltySeconds = this.scene.instantDeathMode ? 30 : 15;

        // Make player briefly invulnerable to prevent multiple hits
        playerSprite.invulnerable = true;

        // Visual feedback for spike hit
        this.scene.tweens.add({
            targets: playerSprite,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            repeat: 2,
            onComplete: () => {
                // Remove invulnerability after the visual effect
                this.scene.time.delayedCall(1500, () => {
                    playerSprite.invulnerable = false;
                });
            },
        });

        // Play a spike hit sound if available
        if (this.scene.audioManager) {
            this.scene.audioManager.playSfx("spike_hit", 0.5);
        } else if (this.scene.sound && this.scene.sound.add) {
            try {
                const hitSound = this.scene.sound.add("spike_hit", { volume: 0.5 });
                hitSound.play();
            } catch (error) {
                // Sound not available, continue silently
            }
        }

        // Create hit particles for better visual feedback
        if (this.scene.add && this.scene.add.particles) {
            try {
                const particles = this.scene.add.particles(playerSprite.x, playerSprite.y, "particle", {
                    speed: { min: 50, max: 200 },
                    scale: { start: 0.5, end: 0 },
                    quantity: 20,
                    lifespan: 800,
                    blendMode: "ADD",
                    tint: 0xff0000, // Red particles
                });

                // Auto-destroy the particles
                this.scene.time.delayedCall(1000, () => {
                    particles.destroy();
                });
            } catch (error) {
                // Particles not available, continue silently
            }
        }

        // Apply time penalty through gameTimer
        if (this.scene.gameTimer) {
            this.scene.gameTimer.applyPenalty(penaltySeconds);

            // Display penalty text
            const penaltyText = this.scene.add
                .text(playerSprite.x, playerSprite.y - 50, `-${penaltySeconds}s`, {
                    fontFamily: "Arial",
                    fontSize: "24px",
                    color: "#ff0000",
                    stroke: "#000000",
                    strokeThickness: 4,
                })
                .setOrigin(0.5);

            // Animate and destroy the penalty text
            this.scene.tweens.add({
                targets: penaltyText,
                y: penaltyText.y - 80,
                alpha: 0,
                duration: 1500,
                ease: "Power2",
                onComplete: () => penaltyText.destroy(),
            });
        }
    }

    handleMovingPlatformCollision(playerSprite, platform) {
        // Extract platform dimensions and positions
        const platformWidth = platform.width;
        const platformHeight = platform.height;
        const platformTop = platform.y - platformHeight / 2;
        const platformLeft = platform.x - platformWidth / 2;
        const platformRight = platform.x + platformWidth / 2;

        // Extract player information
        const playerBottom = playerSprite.y + playerSprite.height / 2;
        const playerIsFalling = playerSprite.body.velocity.y > 0;
        const playerLeft = playerSprite.x - playerSprite.width / 2;
        const playerRight = playerSprite.x + playerSprite.width / 2;

        // Calculate vertical and horizontal distance
        const yDistance = Math.abs(playerBottom - platformTop);
        const isPlayerAbove = playerBottom <= platformTop + 10;

        // Determine if player is horizontally within platform boundaries (with some margin)
        const isHorizontallyAligned = playerRight > platformLeft + 5 && playerLeft < platformRight - 5;

        // Check if player is on the platform
        const isOnPlatform =
            (playerSprite.body.touching.down && platform.body.touching.up) ||
            (isPlayerAbove && isHorizontallyAligned && yDistance < 12 && playerIsFalling);

        // Clear relative position if player is not on any platform
        if ((!isOnPlatform && playerSprite.body.touching.down === false) || playerSprite.body.velocity.y < 0) {
            playerSprite.platformRelativePosition = null;
            playerSprite.previousX = null;
            playerSprite.inputVelocityX = null;
        }

        // Main collision handling logic with improved conditions
        if (isOnPlatform) {
            // If very close to platform but not technically touching, snap player to platform
            if (isPlayerAbove && yDistance < 12 && !playerSprite.body.touching.down) {
                playerSprite.y = platformTop - playerSprite.height / 2;
                playerSprite.body.y = playerSprite.y - playerSprite.height / 2;
                playerSprite.body.velocity.y = 0;
                // Force touching state update
                playerSprite.body.touching.down = true;
                platform.body.touching.up = true;
            }

            // Set horizontal velocity to match platform's motion while preserving player input
            if (platform.body.velocity.x !== 0) {
                // Store player's input-based velocity before applying platform movement
                if (!playerSprite.inputVelocityX) {
                    playerSprite.inputVelocityX = 0;
                }

                // Calculate player's input velocity by subtracting platform velocity from total
                // Only update if there's a significant difference to avoid jitter
                const velocityDifference = playerSprite.body.velocity.x - platform.body.velocity.x;
                if (Math.abs(velocityDifference) > 10) {
                    playerSprite.inputVelocityX = velocityDifference;
                }

                // Apply combined velocity (platform + player input)
                playerSprite.body.velocity.x = platform.body.velocity.x + playerSprite.inputVelocityX;

                // Only make small corrective position adjustments if player is drifting off the platform
                // This prevents teleporting while still keeping player on platform
                const playerCenterX = playerSprite.x;
                const platformCenterX = platform.x;

                // Instead of correcting towards center, maintain relative position
                // Store initial relative position when player lands on platform
                if (!playerSprite.platformRelativePosition) {
                    playerSprite.platformRelativePosition = playerCenterX - platformCenterX;
                }

                // Get player's input-based movement (the difference from the last frame)
                const playerInputMovement = playerSprite.x - (playerSprite.previousX || playerSprite.x);

                // Update the relative position based on player input
                if (Math.abs(playerInputMovement) > 0.1) {
                    playerSprite.platformRelativePosition += playerInputMovement;
                }

                // Adjust player position to maintain the relative position plus any input movement
                const targetPosition = platformCenterX + playerSprite.platformRelativePosition;

                // Use lerp for smoothing to reduce flickering
                const lerpFactor = 0.5; // Higher value = less smoothing but more responsive
                playerSprite.x = Phaser.Math.Linear(playerSprite.x, targetPosition, lerpFactor);

                // Store the current position for the next frame
                playerSprite.previousX = playerSprite.x;
            }

            // Handle vertical velocity differently based on platform direction
            if (platform.body.velocity.y !== 0) {
                // When the platform moves down, make the player stick to it
                // When the platform moves up, allow the player to jump off naturally
                if (platform.body.velocity.y > 0) {
                    playerSprite.body.velocity.y = platform.body.velocity.y;
                } else {
                    // If platform is moving up, only apply upward velocity if player is firmly on the platform
                    const playerBottom = playerSprite.body.y + playerSprite.body.height;
                    const platformTop = platform.body.y - platform.body.height / 2;
                    const distanceToTop = Math.abs(playerBottom - platformTop);

                    if (distanceToTop < 5) {
                        playerSprite.body.velocity.y = platform.body.velocity.y;
                    }
                }
            }

            // Mark the player as standing on a moving platform for the next frame
            playerSprite.isOnMovingPlatform = true;
        } else {
            // Player is not touching the platform (or not from above)
            playerSprite.isOnMovingPlatform = false;
        }
    }

    handlePortalCollision(playerSprite, portal) {
        // Check if there's a reference to the player on the sprite itself
        const playerRef = playerSprite.playerRef;

        // Log for debugging
        console.log("Portal collision detected", {
            playerSpriteExists: !!playerSprite,
            portalExists: !!portal,
            playerRefExists: !!playerRef,
            hasToggleUfoMode: playerRef && typeof playerRef.toggleUfoMode === "function",
        });

        // Check if we found the player reference
        if (playerRef && typeof playerRef.toggleUfoMode === "function") {
            // Toggle UFO mode using the player reference
            playerRef.toggleUfoMode();
            console.log("Player collided with portal. UFO mode toggled.");

            // Add portal effect
            if (this.scene.tweens) {
                this.scene.tweens.add({
                    targets: portal,
                    scaleX: 1.2,
                    scaleY: 1.2,
                    duration: 100,
                    yoyo: true,
                    repeat: 1,
                    ease: "Power1",
                });
            }

            // Disable portal temporarily to prevent immediate re-triggering
            portal.body.enable = false;
            this.scene.time.delayedCall(1500, () => {
                if (portal && portal.body) portal.body.enable = true;
            });
        } else {
            console.warn("Portal collision failed: Could not find player reference or toggleUfoMode method.");
        }
    }

    handleGameOver(reason = "default") {
        console.log("Game over triggered:", reason);

        // Notify server that this player has game over
        if (this.socket && this.socket.connected && this.lobbyId) {
            this.socket.emit("playerGameOver", {
                lobbyId: this.lobbyId,
                reason: reason,
            });
        }

        // Stop music with fade out if it exists
        if (this.levelMusic) {
            this.tweens.add({
                targets: this.levelMusic,
                volume: 0,
                duration: 1000,
                onComplete: () => {
                    this.levelMusic.stop();

                    // Navigate to Game Over scene
                    this.scene.start("GameOver", {
                        levelId: this.levelId,
                        playerName: this.playerName,
                        socket: this.socket,
                        lobbyId: this.lobbyId,
                        reason: reason,
                    });
                },
            });
        } else {
            // No music to fade, switch immediately
            this.scene.start("GameOver", {
                levelId: this.levelId,
                playerName: this.playerName,
                socket: this.socket,
                lobbyId: this.lobbyId,
                reason: reason,
            });
        }
    }
}
