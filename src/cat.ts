import * as pc from "playcanvas";

type CatState = 'SLEEP' | 'IDLE' | 'WANDER' | 'CHASE_TARGET' | 'POUNCE_TARGET' | 'DISTRACTED' | 'JUMPING';

export class Cat extends pc.Script {
    // TODO: Broken for some reason, might be webpack related, avoid static vars for now:
    /*
    Uncaught TypeError: Cannot set property scriptName of class Script extends _core_event_handler_js__WEBPACK_IMPORTED_MODULE_0__.EventHandler {
        static{
            /**...<omitted>...
    } which has only a getter
    */
    //static scriptName = "catController";
    
    private state: CatState = "SLEEP";
    private stateTimer: number = 0;
    private stateTimeout: number = 0;
    
    // Movement properties
    private readonly moveSpeed: number = 1.2;
    private movementDirection: pc.Vec3 = new pc.Vec3();
    
    // Jumping physics
    private velocity: pc.Vec3 = new pc.Vec3();
    private acceleration: pc.Vec3 = new pc.Vec3(0, -9.8, 0);
    private readonly jumpSpeed: number = 6;
    private isJumping: boolean = false;
    private floorY: number;
    
    // Targeting
    private potentialTargets: pc.Entity[] = [];
    private targetEntity: pc.Entity | null = null;

    // Wandering movement
    private wanderTarget: pc.Vec3 = new pc.Vec3();
    private wanderTimer: number = 0;
    private readonly WANDER_DISTANCE: number = 1.0;
    private readonly WANDER_TARGET_TIMEOUT: number = 1.5;
    
    // State durations
    private readonly WANDER_CHECK_INTERVAL: number = 2; // seconds
    private readonly DISTRACTED_DURATION: number = 1; // seconds
    private readonly POUNCE_TELEGRAPH_DURATION: number = 1; // seconds
    private readonly CHASE_RADIUS: number = 2;
    private readonly POUNCE_RADIUS: number = 6;

    initialize() {
        // Start in IDLE state
        this.changeState("SLEEP");

        this.floorY = this.entity.getPosition().y

        this.app.on("cat:changeState", this.changeState.bind(this));
        this.app.on("cat:setPotentialTargets", this.setPotentialTargets.bind(this));
        this.app.on("cat:findNewTarget", this.findNewTarget.bind(this));
    }

    update(dt: number) {
        this.stateTimer += dt;
        
        // Update current state
        switch (this.state) {
            case 'SLEEP':
                this.updateSleep(dt);
                break;
            case 'IDLE':
                this.updateIdle(dt);
                break;
            case 'WANDER':
                this.updateWander(dt);
                break;
            case 'CHASE_TARGET':
                this.updateChaseTarget(dt);
                break;
            case 'POUNCE_TARGET':
                this.updatePounceTarget(dt);
                break;
            case 'DISTRACTED':
                this.updateDistracted(dt);
                break;
            case 'JUMPING':
                this.updateJumping(dt);
                break;
        }
        
        this.updatePhysics(dt);
    }

    setPotentialTargets(targets: pc.Entity[]) {
        this.potentialTargets = targets;
    }

    private targetActive(): boolean {
        return this.targetEntity && this.targetEntity.enabled;
    }

    private changeState(newState: CatState) {
        // Exit current state
        //console.log("Exiting state " + this.state);
        this.onStateExit(this.state);
        
        // Change to new state
        this.state = newState;
        this.stateTimer = 0;
        
        // Enter new state
        //console.log("Entering state " + newState);
        this.onStateEnter(newState);
    }

    private onStateEnter(newState: CatState) {
        const tailRoot = this.entity.findByName("TailRoot");
        switch (newState) {
            case 'IDLE':
                tailRoot.setLocalEulerAngles(40, 0, 0);
                this.stateTimeout = 0;
                break;
            case 'WANDER':
                tailRoot.setLocalEulerAngles(40, 0, 0);
                this.wanderTarget = this.entity.getPosition().clone();
                this.stateTimeout = this.WANDER_CHECK_INTERVAL;
                break;
            case 'CHASE_TARGET':
                if (this.targetActive()) {
                    tailRoot.setLocalEulerAngles(0, 0, 0);
                    this.faceTarget(this.targetEntity);
                    this.stateTimeout = 0.2; // Wait before moving
                }
                break;
            case 'POUNCE_TARGET':
                if (this.targetActive()) {
                    this.faceTarget(this.targetEntity);
                    // Play telegraph animation
                    if (tailRoot) {
                        tailRoot.setLocalEulerAngles(-60, 0, 0);
                    }
                    this.stateTimeout = this.POUNCE_TELEGRAPH_DURATION;
                }
                break;
            case 'DISTRACTED':
                this.stateTimeout = this.DISTRACTED_DURATION;
                const catPos = this.entity.getPosition();
                this.wanderTarget.set(catPos.x, this.floorY, catPos.z);
                this.findNewTarget();
                break;
            case 'JUMPING':
                // Jumping state has no timeout, exits when landing
                break;
        }
    }

    private onStateExit(oldState: CatState) {
        switch (oldState) {
            case 'CHASE_TARGET':
            case 'POUNCE_TARGET':
                // Clear target when leaving these states
                //this.targetEntity = null;
                break;
            case 'WANDER':
                this.wanderTarget.set(0, this.entity.getPosition().y, 0);
                //this.wanderTimer = 0;
                break;
            case 'DISTRACTED':
                // Animation here
                break;
        }
    }

    private updateSleep(dt: number) {
        this.velocity = new pc.Vec3();
    }

    private updateIdle(dt: number) {
        // Transition to WANDER immediately on game start
        this.changeState('WANDER');
    }

    private updateWander(dt: number) {
        const catPos = this.entity.getPosition();
        
        // Always check for new targets periodically (keeps original behavior)
        if (this.stateTimer >= this.stateTimeout) {
            this.findNewTarget();
            this.stateTimer = 0;
        }
        
        // Handle wander timing
        this.wanderTimer += dt;
        
        // Set new wander target or stop moving periodically
        if (this.wanderTimer >= this.WANDER_TARGET_TIMEOUT) {
            // 50% chance to move to a new target, 50% chance to stop
            if (Math.random() > 0.5 && this.WANDER_DISTANCE > 0) {
                // Generate new random target
                const angle = Math.random() * 2 * Math.PI;
                const distance = Math.random() * this.WANDER_DISTANCE;
                
                this.wanderTarget.x = catPos.x + Math.cos(angle) * distance;
                this.wanderTarget.z = catPos.z + Math.sin(angle) * distance;
                this.wanderTarget.y = catPos.y; // Keep ground level
            }
            else {
                // Clear wander target (cat stops moving)
                this.wanderTarget.set(0, 0, 0);
            }
            this.wanderTimer = 0;
        }

        // Move towards wander target if it's set
        if (this.wanderTarget) {
            // Calculate direction on x-z plane
            this.movementDirection.x = this.wanderTarget.x - catPos.x;
            this.movementDirection.z = this.wanderTarget.z - catPos.z;
            this.movementDirection.y = 0;
            
            const distanceToTarget = this.movementDirection.length();
            const threshold = 0.1;

            if (distanceToTarget < threshold) {
                // Reached target, clear it
                this.wanderTarget.set(0, 0, 0);
                this.movementDirection.set(0, 0, 0);
            }
            else {
                // Move towards target
                this.movementDirection.normalize();
                
                const movement = this.movementDirection.clone().mulScalar(this.moveSpeed * dt);
                const newPosition = catPos.clone().add(movement);
                
                newPosition.y = catPos.y; // Maintain ground level
                this.entity.setPosition(newPosition);

                // Face movement direction
                const lookTarget = newPosition.clone().add(this.movementDirection);
                lookTarget.y = catPos.y;
                this.entity.lookAt(lookTarget);
            }
        }
        else {
            // No wander target, stop movement
            this.movementDirection.set(0, 0, 0);
        }
    }

    private updateChaseTarget(dt: number) {
        if (!this.targetActive()) {
            // Target was removed, go to IDLE then WANDER
            this.changeState('IDLE');
            return;
        }

        // Face target at the beginning
        if (this.stateTimer < this.stateTimeout) {
            this.faceTarget(this.targetEntity);
            return;
        }

        // Move towards target on x-z plane only
        const targetPos = this.targetEntity.getPosition();
        const catPos = this.entity.getPosition();
        
        // Calculate direction on x-z plane
        this.movementDirection.x = targetPos.x - catPos.x;
        this.movementDirection.y = 0; // No vertical movement
        this.movementDirection.z = targetPos.z - catPos.z;
        this.movementDirection.normalize();
        
        const movement = this.movementDirection.clone().mulScalar(this.moveSpeed * dt);
        
        const newPosition = catPos.clone().add(movement);
        this.entity.setPosition(newPosition);
        
        // Look in movement direction (only on x-z plane)
        const lookTarget = newPosition.clone().add(this.movementDirection);
        lookTarget.y = catPos.y; // Keep the same height
        this.entity.lookAt(lookTarget);
        
        // Check if reached target (within 0.5 units on x-z plane)
        const xzDistance = Math.sqrt(
            Math.pow(targetPos.x - catPos.x, 2) + 
            Math.pow(targetPos.z - catPos.z, 2)
        );
        
        if (xzDistance < 0.5) {
            //this.targetEntity = null;
            //this.changeState('IDLE');
        }
    }

    private updatePounceTarget(dt: number) {
        if (!this.targetActive() && !this.isJumping) {
            // Target was removed, go to IDLE then WANDER
            this.changeState('IDLE');
            return;
        }

        // Telegraph phase
        if (this.stateTimer < this.POUNCE_TELEGRAPH_DURATION) {
            this.faceTarget(this.targetEntity);
            return;
        }

        // Jump initiation
        if (this.stateTimer >= this.POUNCE_TELEGRAPH_DURATION && !this.isJumping) {
            this.initiateJump();
        }
    }

    private updateDistracted(dt: number) {
        if (this.stateTimer >= this.stateTimeout) {
            this.changeState('WANDER');
        }
    }

    private updateJumping(dt: number) {
        // Physics update is handled in the main update loop
        // Check if we've landed
        const pos = this.entity.getPosition();
        const futurePos = pos.clone().add(this.velocity.clone().mulScalar(dt));
        if (futurePos.y <= this.floorY) {
            futurePos.y = this.floorY;
            this.entity.setPosition(futurePos);
            this.velocity.set(0, 0, 0);
            this.isJumping = false;
            this.changeState('DISTRACTED');
        }
    }

    private updatePhysics(dt: number) {
        // Update velocity with acceleration
        this.velocity.add(this.acceleration.clone().mulScalar(dt));
        
        // Update position with velocity
        const pos = this.entity.getPosition();
        pos.add(this.velocity.clone().mulScalar(dt));
        
        // Apply ground constraint
        if (pos.y <= this.floorY) {
            pos.y = this.floorY;
            this.velocity.set(0, 0, 0);
            this.isJumping = false;
        }
        
        this.entity.setPosition(pos);
    }

    private findNewTarget() {
        if (this.state === "SLEEP") return;

        const catPos = this.entity.getPosition();
        let closestTarget: pc.Entity | null = null;
        let closestDistance = Infinity;

        // Find the closest target
        for (const target of this.potentialTargets) {
            if (!target.enabled) continue;

            const targetPos = target.getPosition();
            // Calculate distance on x-z plane only
            const xzDistance = Math.sqrt(
                Math.pow(targetPos.x - catPos.x, 2) + 
                Math.pow(targetPos.z - catPos.z, 2)
            );
            
            if (xzDistance < closestDistance) {
                closestDistance = xzDistance;
                closestTarget = target as pc.Entity;
            }
        }

        if (closestTarget) {
            this.targetEntity = closestTarget;
            
            if (closestDistance <= this.CHASE_RADIUS) {
                if (this.state !== "CHASE_TARGET" && this.state !== "JUMPING"){
                    this.changeState('CHASE_TARGET');
                }
            }
            else if (closestDistance <= this.POUNCE_RADIUS) {
                if (this.state !== "POUNCE_TARGET" && this.state !== "JUMPING"){
                    this.changeState('POUNCE_TARGET');
                }
            }
            else {
                this.changeState("IDLE");
            }
        }
    }

    private faceTarget(target: pc.Entity) {
        const targetPos = target.getPosition();
        const catPos = this.entity.getPosition();
        
        // Face target on x-z plane only
        const lookPos = new pc.Vec3(targetPos.x, catPos.y, targetPos.z);
        this.entity.lookAt(lookPos);
    }

    private initiateJump() {
        if (!this.targetActive()) return;
        
        this.isJumping = true;

        const catPos = this.entity.getPosition();
        const targetPos = this.targetEntity.getPosition();
        
        // Calculate horizontal distance to target
        const dx = targetPos.x - catPos.x;
        const dz = targetPos.z - catPos.z;
        const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
        
        // Optimal angle for maximum distance is 45 degrees
        const optimalAngle = Math.PI / 4;
        
        // Calculate the required initial speed to reach the target at 45 degrees
        const gravityMagnitude = Math.abs(this.acceleration.y);
        const optimalSpeed = Math.sqrt((gravityMagnitude * horizontalDistance) / Math.sin(2 * optimalAngle));
        
        // If the optimal speed is <= max jump speed, use it
        if (optimalSpeed <= this.jumpSpeed) {
            // Use 45 degree trajectory
            const horizontalSpeed = optimalSpeed * Math.cos(optimalAngle);
            const verticalSpeed = optimalSpeed * Math.sin(optimalAngle);
            
            // Set velocity components
            if (horizontalDistance > 0) {
                this.velocity.x = (dx / horizontalDistance) * horizontalSpeed;
                this.velocity.z = (dz / horizontalDistance) * horizontalSpeed;
            }
            else {
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
            this.velocity.y = verticalSpeed;
        }
        else {
            // 45 degree trajectory would require too much speed, so we need to use a higher arc
            // Calculate the minimum angle that achieves the distance with our max speed
            // and ensures a minimum arc height
            const minArcHeight = 0.25;
            
            const v = this.jumpSpeed;
            const g = gravityMagnitude;
            const d = horizontalDistance;
            
            // Calculate the two possible angles for the given speed and distance
            const discriminant = v * v * v * v - g * (g * d * d + 2 * minArcHeight * v * v);
            
            if (discriminant >= 0) {
                // Two possible angles exist
                const sqrtDiscriminant = Math.sqrt(discriminant);
                const tanTheta1 = (v * v + sqrtDiscriminant) / (g * d);
                const tanTheta2 = (v * v - sqrtDiscriminant) / (g * d);
                
                const angle1 = Math.atan(tanTheta1);
                const angle2 = Math.atan(tanTheta2);
                
                // Choose the higher angle (more arc) to ensure minimum height
                const launchAngle = Math.max(angle1, angle2);
                
                // Calculate velocity components
                const horizontalSpeed = v * Math.cos(launchAngle);
                const verticalSpeed = v * Math.sin(launchAngle);
                
                if (horizontalDistance > 0) {
                    this.velocity.x = (dx / horizontalDistance) * horizontalSpeed;
                    this.velocity.z = (dz / horizontalDistance) * horizontalSpeed;
                }
                else {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }
                this.velocity.y = verticalSpeed;
            }
            else {
                // Even our max speed can't reach the target with minimum height
                // Use the highest possible arc (90 degrees isn't useful, so use a high but reasonable angle)
                const fallbackAngle = Math.PI / 3; // 60 degrees
                const horizontalSpeed = this.jumpSpeed * Math.cos(fallbackAngle);
                const verticalSpeed = this.jumpSpeed * Math.sin(fallbackAngle);
                
                if (horizontalDistance > 0) {
                    this.velocity.x = (dx / horizontalDistance) * horizontalSpeed;
                    this.velocity.z = (dz / horizontalDistance) * horizontalSpeed;
                }
                else {
                    this.velocity.x = 0;
                    this.velocity.z = 0;
                }
                this.velocity.y = verticalSpeed;
            }
        }

        this.changeState('JUMPING');
    }
}