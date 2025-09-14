import * as pc from 'playcanvas';
import { VRButton } from './vr-button';
import { createText } from './create-text';
import { PointerLight } from './pointer-light';
import { createTexture, CustomRaycastResult, rayAABBIntersection, raycast } from './utils';
import { Cat } from './cat';
import floorImageFile from "../assets/floor.png";
import fencePostModel from "../assets/fence_post.glb";
import { FencePost } from './fencepost';
import { generateClouds } from './clouds';

// @config WEBGPU_DISABLED
const canvas = document.getElementById('application') as HTMLCanvasElement;
window.focus();

/**
 * @param {string} msg - The message.
 */
const message = function (msg) {
    /** @type {HTMLDivElement} */
    let el = document.querySelector('.message');
    if (!el) {
        el = document.createElement('div');
        el.classList.add('message');
        document.body.append(el);
    }
    el.textContent = msg;
};

const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window)
});

app.elementInput = new pc.ElementInput(canvas);

// Set the canvas to fill the window and automatically change resolution to be the same as the canvas size
app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
app.setCanvasResolution(pc.RESOLUTION_AUTO);

// Ensure canvas is resized when window changes size
const resize = () => app.resizeCanvas();
window.addEventListener('resize', resize);
app.on('destroy', () => {
    window.removeEventListener('resize', resize);
});

// use device pixel ratio
app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;

app.start();

// create camera parent
const cameraParent = new pc.Entity();
app.root.addChild(cameraParent);

// create camera
const c = new pc.Entity();
c.addComponent('camera', {
    clearColor: new pc.Color(0.173, 0.243, 0.314),
    farClip: 10000
});
cameraParent.addChild(c);

// Lighting
const l = new pc.Entity();
l.addComponent('light', {
    type: 'directional',
});
l.rotate(-45, 135, 0);
app.root.addChild(l);
app.scene.ambientLight = pc.Color.GRAY;

// Procedural skybox
const skyColor = new pc.Color(0.337, 0.58, 0.867);
const skyTexture = createTexture(app, 4, skyColor, skyColor);
app.scene.skybox = skyTexture;

// Clouds
for(let x = -10; x < 10; x++){
    for(let y = -10; y < 10; y++){
        if(Math.random() < 0.04){
            generateClouds(app, 5, new pc.Vec3(x*3 + pc.math.random(-3,3), 5, y*3 + pc.math.random(-3,3)));
        }
    }
}

// Without ammo.js, we need to manually track all solid entities
const solids: pc.Entity[] = [];

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createBox = function (x: number, y: number, z: number, w: number, h: number, l: number): pc.Entity {
    const cube = new pc.Entity();
    cube.addComponent('render', {
        type: 'box',
        material: new pc.StandardMaterial()
    });
    cube.setLocalScale(w, h, l);
    cube.translate(x, y, z);
    app.root.addChild(cube);
    solids.push(cube);

    return cube;
};

// Create controller laser pointers
const controllers = [];
const laserPointerAngleOffset = new pc.Vec3(90, 0, 0);
const createController = function (inputSource) {
    // Root entity
    const rootEntity = new pc.Entity();
    rootEntity.addComponent("model", {
        type: "box"
    });
    rootEntity.model.hide();
    controllers.push(rootEntity);
    cameraParent.addChild(rootEntity);
    // @ts-ignore engine-tsd
    rootEntity.inputSource = inputSource;

    // Laser pointer model
    const entity = new pc.Entity("LaserPointer");
    entity.addComponent('model', {
        type: MODEL_CYLINDER
    });
    entity.setLocalScale(0.03, 0.12, 0.03);
    entity.setLocalRotation(new pc.Quat().setFromEulerAngles(laserPointerAngleOffset));
    rootEntity.addChild(entity);

    // destroy input source related entity
    // when input source is removed
    inputSource.on('remove', () => {
        controllers.splice(controllers.indexOf(rootEntity), 1);
        rootEntity.destroy();
    });
};

// Floor
const FLOOR_WIDTH = 8;
const FLOOR_LENGTH = 8;
const floorImage = new Image();
floorImage.src = floorImageFile;
floorImage.onload = () => {
    const floor = createBox(0, -1.5, 0, FLOOR_WIDTH + 1, 1, FLOOR_LENGTH + 1);
    floor.name = "Floor";
    const floorMaterial = floor.render.material as pc.StandardMaterial;
    const floorTexture = new pc.Texture(app.graphicsDevice, {
        width: floorImage.width,
        height: floorImage.height,
        format: pc.PIXELFORMAT_R8_G8_B8_A8,
        magFilter: pc.FILTER_LINEAR,
        minFilter: pc.FILTER_LINEAR
    });
    floorTexture.setSource(floorImage);
    floorTexture.minFilter = pc.FILTER_NEAREST;
    floorTexture.magFilter = pc.FILTER_NEAREST;
    
    floorMaterial.diffuse = new pc.Color(0.3, 0.81, 0.43);
    floorMaterial.diffuseMap = floorTexture;
    floorMaterial.diffuseMapTiling = new pc.Vec2(8, 8);
};

// Create title screen
const screen = new pc.Entity("TitleScreen");
screen.setLocalScale(0.01, 0.01, 0.01);
screen.setPosition(0, 0, -2.5);
screen.addComponent('screen', {
    referenceResolution: new pc.Vec2(1280, 720),
    screenSpace: false
});
app.root.addChild(screen);

// Title text
const titleEntity = createText(app, "Laser Pointer Cat", 0, 48, 200, 100, new pc.Color(), 36);
screen.addChild(titleEntity);

// Start game button
const startButton = new VRButton(app, {
    text: "Start",
    position: new pc.Vec3(0, -24, 0),
    width: 80,
    height: 40,
    fontSize: 24,
    textColor: new pc.Color(),
    backgroundColor: pc.Color.WHITE,
    hoverTint: new pc.Color(0, 0.5, 1, 1),
    pressedTint: new pc.Color(0.5, 1, 0.5, 1),
    inactiveTint: new pc.Color(1, 1, 1, 0.5),
    clickCallback: () => {
        if (gameState === 0) {
            gameState = 1;
            setTimeout(() => {
                titleEntity.enabled = false;
                startButton.entity.enabled = false;
                app.fire("cat:changeState", "IDLE");
            }, 800);
        }
    }
});
screen.addChild(startButton.entity);

// Gameplay setup
let gameState = 0; // 0 = title, 1 = gameplay
const pointerLights: PointerLight[] = [];
//let selectHeld = 0; // 1 = trigger held, 0 = no trigger held

// Create fence posts around perimeter
const fencePostModelFileData = {
    url: fencePostModel,
    filename: fencePostModel
};
const fenceAsset = new pc.Asset(fencePostModel, 'container', fencePostModelFileData, null, null);
fenceAsset.once('load', function (containerAsset: pc.Asset) {
    const initialPos = new pc.Vec3(0, -1, 0);
    const rot = new pc.Vec3();
    const scale = new pc.Vec3(1, 1, 1);
    const fence = new FencePost(initialPos, rot, scale, containerAsset.resource as pc.ContainerResource);
    
    const postWidth = 0.232;
    const postDepth = 0.276;
    const halfLength = 4.25;
    const gapBetweenPosts = 0.3;
    
    // For the longer sides (where posts are placed along z-axis)
    const availableLengthZ = 2 * halfLength - postWidth; // Subtract one post width
    const idealCountZ = Math.floor(availableLengthZ / (postDepth + gapBetweenPosts));
    const actualGapZ = (availableLengthZ - idealCountZ * postDepth) / idealCountZ;
    
    // For the shorter sides (where posts are placed along x-axis)
    const availableLengthX = 2 * halfLength - postDepth; // Subtract one post depth
    const idealCountX = Math.floor(availableLengthX / (postWidth + gapBetweenPosts));
    const actualGapX = (availableLengthX - idealCountX * postWidth) / idealCountX;
    
    // North side
    let posNum = -halfLength + postWidth/2; // Start position (left side)
    for (let i = 0; i < idealCountX + 1; i++) {
        const pos = new pc.Vec3(posNum, -1, -halfLength);
        const rot = new pc.Vec3(0, -90, 0);
        const clone = fence.entity.clone();
        clone.setPosition(pos);
        clone.setEulerAngles(rot);
        app.root.addChild(clone);
        solids.push(clone);
        posNum += postWidth + actualGapX;
    }
    
    // East side
    let posEast = -halfLength + postWidth/2; // Start position (top side)
    for (let i = 0; i < idealCountZ + 1; i++) {
        const pos = new pc.Vec3(halfLength, -1, posEast);
        const rot = new pc.Vec3(0, 180, 0);
        const clone = fence.entity.clone();
        clone.setPosition(pos);
        clone.setEulerAngles(rot);
        app.root.addChild(clone);
        solids.push(clone);
        posEast += postDepth + actualGapZ;
    }
    
    // South side
    let posSouth = -halfLength + postWidth/2; // Start position (left side)
    for (let i = 0; i < idealCountX + 1; i++) {
        const pos = new pc.Vec3(posSouth, -1, halfLength);
        const rot = new pc.Vec3(0, 90, 0);
        const clone = fence.entity.clone();
        clone.setPosition(pos);
        clone.setEulerAngles(rot);
        app.root.addChild(clone);
        solids.push(clone);
        posSouth += postWidth + actualGapX;
    }
    
    // West side
    let posWest = -halfLength + postWidth/2; // Start position (top side)
    for (let i = 0; i < idealCountZ + 1; i++) {
        const pos = new pc.Vec3(-halfLength, -1, posWest);
        const rot = new pc.Vec3(0, 0, 0);
        const clone = fence.entity.clone();
        clone.setPosition(pos);
        clone.setEulerAngles(rot);
        app.root.addChild(clone);
        solids.push(clone);
        posWest += postDepth + actualGapZ;
    }
});
app.assets.add(fenceAsset);
app.assets.load(fenceAsset);

// Cat model
const MODEL_BOX = "box";
const MODEL_CYLINDER = "cylinder";
const catEntity = new pc.Entity();
catEntity.addComponent("script");
catEntity.translate(0, 0.168, 0);
//catEntity.rotate(0, 45, 0);
catEntity.script.create(Cat);

const catBody = new pc.Entity("Body");
catBody.addComponent("model", {type: MODEL_BOX});
catBody.setLocalScale(0.2, 0.18, 0.4);
catEntity.addChild(catBody);

const leg = new pc.Entity("Leg");
leg.addComponent("model", {type: MODEL_BOX});
leg.setLocalScale(0.27, 0.5, 0.11);
leg.setLocalPosition(0.3, -0.7, 0.4);
catBody.addChild(leg);
const leg2 = leg.clone();
leg2.setLocalPosition(0.3, -0.7, -0.4);
catBody.addChild(leg2);
const leg3 = leg.clone();
leg3.setLocalPosition(-0.3, -0.7, 0.4);
catBody.addChild(leg3);
const leg4 = leg.clone();
leg4.setLocalPosition(-0.3, -0.7, -0.4);
catBody.addChild(leg4);

const catHead = new pc.Entity();
catHead.addComponent("model", {type: MODEL_BOX});
catHead.setLocalScale(0.16, 0.15, 0.17);
catHead.setLocalPosition(0, 0.05, -0.28);
catEntity.addChild(catHead);

const ear = new pc.Entity("Ear");
ear.addComponent("model", {type: "cone"});
ear.setLocalScale(0.3, 0.45, 0.3);
ear.setLocalPosition(0.4, 0.65, 0.3);
catHead.addChild(ear);
const ear2 = ear.clone();
ear2.setLocalPosition(-0.4, 0.65, 0.3);
catHead.addChild(ear2);
ear.setLocalEulerAngles(0, 0, -20);
ear2.setLocalEulerAngles(0, 0, 20);

const whisker = new pc.Entity();
whisker.addComponent("model", {type: MODEL_BOX});
whisker.setLocalScale(0.8, 0.05, 0.05);
whisker.setLocalPosition(0.45, -0.057, -0.536);
whisker.setLocalEulerAngles(0, 0, 8);
catHead.addChild(whisker);
const whisker2 = whisker.clone();
whisker2.setLocalEulerAngles(0, 0, -8);
whisker2.setLocalPosition(-0.45, -0.057, -0.536);
catHead.addChild(whisker2);
const whisker3 = whisker.clone();
whisker3.setLocalEulerAngles(0, 0, -10);
whisker3.setLocalPosition(0.45, -0.212, -0.536);
catHead.addChild(whisker3);
const whisker4 = whisker.clone();
whisker4.setLocalEulerAngles(0, 0, 10);
whisker4.setLocalPosition(-0.45, -0.212, -0.536);
catHead.addChild(whisker4);

const tailRoot = new pc.Entity("TailRoot");
tailRoot.setLocalPosition(0, 0.04, 0.192);
catEntity.addChild(tailRoot);
const tail = new pc.Entity("Tail");
tail.addComponent("model", {type: MODEL_BOX});
tail.setLocalScale(0.04, 0.04, 0.3);
tail.setLocalPosition(0, 0.014, 0.13);
tailRoot.addChild(tail);

const catMaterial = new pc.StandardMaterial();
catMaterial.diffuse = new pc.Color(0.1, 0.1, 0.1);
// Loop 2 layers deep to apply material
catEntity.children.forEach((obj) => {
    if(obj instanceof pc.Entity) {
        if (obj.model) {
            obj.model.material = catMaterial;
        }
        obj.children.forEach((obj2) => {
            if (obj2 instanceof pc.Entity) {
                if (obj2.model) {
                    obj2.model.material = catMaterial;
                }
            }
        })
    }
});

const bandana = new pc.Entity("Bandana");
bandana.addComponent("model", {type: MODEL_BOX});
bandana.setLocalScale(1.1, 0.5, 1.1);
bandana.setLocalPosition(0, 0.162, 0);
const bandanaMaterial = new pc.StandardMaterial();
bandanaMaterial.diffuse = new pc.Color(0.729, 0.031, 0.031)
bandana.model.material = bandanaMaterial;
catHead.addChild(bandana);

const eye = new pc.Entity();
eye.addComponent("model", {type: MODEL_CYLINDER});
eye.setLocalScale(0.33, 0.13, 0.33);
eye.setLocalPosition(0.26, 0.144, -0.51);
eye.setLocalEulerAngles(90, 0, 0);
catHead.addChild(eye);
const eye2 = eye.clone();
eye2.setLocalPosition(-0.26, 0.144, -0.51);
catHead.addChild(eye2);

const pupilMaterial = new pc.StandardMaterial();
pupilMaterial.diffuse = pc.Color.BLACK;
const pupil = new pc.Entity();
pupil.addComponent("model", {type: MODEL_CYLINDER});
pupil.setLocalScale(0.5, 1, 1);
pupil.setLocalPosition(0, -0.1, 0);
pupil.model.material = pupilMaterial;
eye.addChild(pupil);
const pupil2 = pupil.clone();
eye2.addChild(pupil2);

const nose = new pc.Entity();
nose.addComponent("model", {type: "sphere"});
nose.setLocalScale(0.15, 0.15, 0.15);
nose.setLocalPosition(0, -0.11, -0.56);
catHead.addChild(nose);

const catRoot = new pc.Entity();
catRoot.setLocalPosition(0, -1, 0);
catRoot.rotate(0, 180, 0);
catRoot.addChild(catEntity);
app.root.addChild(catRoot);

let debugControls = false;
const activate = function () {
    if (app.xr.isAvailable(pc.XRTYPE_VR)) {
        c.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
            callback: function (err) {
                if (err) message(`Immersive VR failed to start: ${err.message}`);
            }
        });
    } else {
        message('Immersive VR is not available');

        // DEBUG (disable in final build): controls without VR for testing purposes
        if (debugControls) return;
        debugControls = true;
        
        app.on("update", (dt) => {
            const keyboard = app.keyboard;

            const moveSpeed = 3;

            // WASD movement
            const forward = cameraParent.forward;
            const right = cameraParent.right;

            const velocity = new pc.Vec3();
            if (keyboard.isPressed(pc.KEY_W)) {
                velocity.add(forward.clone().mulScalar(moveSpeed * dt));
            }
            if (keyboard.isPressed(pc.KEY_S)) {
                velocity.add(forward.clone().mulScalar(-moveSpeed * dt));
            }
            if (keyboard.isPressed(pc.KEY_A)) {
                velocity.add(right.clone().mulScalar(-moveSpeed * dt));
            }
            if (keyboard.isPressed(pc.KEY_D)) {
                velocity.add(right.clone().mulScalar(moveSpeed * dt));
            }
            cameraParent.translate(velocity);

            // Limit to map bounds
            const newPos = cameraParent.getPosition();
            newPos.x = pc.math.clamp(newPos.x, -FLOOR_WIDTH/2, FLOOR_WIDTH/2);
            newPos.z = pc.math.clamp(newPos.z, -FLOOR_LENGTH/2, FLOOR_LENGTH/2);
            cameraParent.setPosition(newPos);

            // Turn with left/right
            if (keyboard.isPressed(pc.KEY_LEFT) || keyboard.isPressed(pc.KEY_RIGHT)) {
                let turnDir = 0;
                if (keyboard.isPressed(pc.KEY_LEFT)){
                    turnDir = 1;
                } else if (keyboard.isPressed(pc.KEY_RIGHT)) {
                    turnDir = -1;
                }
                cameraParent.rotateLocal(0, turnDir * 0.5, 0);
            }
        });

        // Debug place target object
        app.mouse.on("mousedown", (event: pc.MouseEvent) => {
            let pos = new pc.Vec3();
            const depth = 10;
            const cameraEntity = cameraParent;
            c.camera.screenToWorld(event.x, event.y, depth, pos);
            // Calculate pointer light positions
            let pointerLight: PointerLight;
            if (pointerLights.length === 0){
                pointerLight = new PointerLight(app);
                pointerLights.push(pointerLight);
                app.fire("cat:setPotentialTargets", pointerLights.map((pl) => pl.entity));
            }
            else {
                pointerLight = pointerLights[0];
            }
            pointerLight.setActive(true);

            // Calculate hit position for pointerLight from the input source
            const ray = new pc.Ray(cameraEntity.getPosition(), pos.sub(cameraEntity.getPosition()));
            const raycastResult: CustomRaycastResult = raycast(ray, cameraEntity, solids);
            
            if (raycastResult.meshHit) {
                const hitPos = rayAABBIntersection(ray.origin, ray.direction, raycastResult.meshHit.aabb);
                if (hitPos) {
                    pointerLight.setPosition(hitPos);
                    app.fire("cat:findNewTarget");
                }
            }
        });
    }
};
app.mouse.on('mousedown', () => {
    if (!app.xr.active) activate();
});
if (app.xr.supported) {

    if (app.touch) {
        app.touch.on('touchend', (evt) => {
            if (!app.xr.active) {
                // if not in VR, activate
                activate();
            } else {
                // otherwise reset camera
                c.camera.endXr();
            }

            evt.event.preventDefault();
            evt.event.stopPropagation();
        });
    }

    // end session by keyboard ESC
    app.keyboard.on('keydown', (evt) => {
        if (evt.key === pc.KEY_ESCAPE && app.xr.active) {
            app.xr.end();
        }
    });

    // when new input source added
    app.xr.input.on('add', (inputSource) => {
        createController(inputSource);
        pointerLights.push(new PointerLight(app));
        app.fire("cat:setPotentialTargets", pointerLights.map((pl) => pl.entity));
    });

    message('Tap on screen to enter VR');

    const movementSpeed = 1.5; // 1.5 m/s
    const rotateSpeed = 45;
    const rotateThreshold = 0.5;
    const rotateResetThreshold = 0.25;
    let lastRotateValue = 0;

    const tmpVec2A = new pc.Vec2();
    const tmpVec2B = new pc.Vec2();
    const tmpVec3A = new pc.Vec3();
    const tmpVec3B = new pc.Vec3();
    const lineColor = new pc.Color(1, 1, 1);

    const vec3A = new pc.Vec3();

    const ray = new pc.Ray();

    // update position and rotation for each controller
    app.on('update', (dt) => {
        let i: number;
        let inputSource: pc.XrInputSource;

        // first we update movement
        for (i = 0; i < controllers.length; i++) {
            inputSource = controllers[i].inputSource;

            // should have gamepad
            if (!inputSource.gamepad) continue;

            // left controller - for movement
            if (inputSource.handedness === pc.XRHAND_LEFT) {
                // set vector based on gamepad thumbstick axes values
                tmpVec2A.set(inputSource.gamepad.axes[2], inputSource.gamepad.axes[3]);

                // if there is input
                if (tmpVec2A.length()) {
                    tmpVec2A.normalize();

                    // we need to take in account camera facing
                    // so we figure out Yaw of camera
                    tmpVec2B.x = c.forward.x;
                    tmpVec2B.y = c.forward.z;
                    tmpVec2B.normalize();

                    const rad = Math.atan2(tmpVec2B.x, tmpVec2B.y) - Math.PI / 2;
                    // and rotate our movement vector based on camera yaw
                    const t = tmpVec2A.x * Math.sin(rad) - tmpVec2A.y * Math.cos(rad);
                    tmpVec2A.y = tmpVec2A.y * Math.sin(rad) + tmpVec2A.x * Math.cos(rad);
                    tmpVec2A.x = t;

                    // set movement speed
                    tmpVec2A.mulScalar(movementSpeed * dt);
                    // move camera parent based on calculated movement vector
                    cameraParent.translate(tmpVec2A.x, 0, tmpVec2A.y);

                    // Limit to map bounds
                    const newPos = cameraParent.getPosition();
                    newPos.x = pc.math.clamp(newPos.x, -FLOOR_WIDTH/2, FLOOR_WIDTH/2);
                    newPos.z = pc.math.clamp(newPos.z, -FLOOR_LENGTH/2, FLOOR_LENGTH/2);
                    cameraParent.setPosition(newPos);
                }

            // right controller - for rotation
            } else if (inputSource.handedness === pc.XRHAND_RIGHT) {
                // get rotation from thumbsitck
                const rotate = -inputSource.gamepad.axes[2];

                // each rotate should be done by moving thumbstick to the side enough
                // then thumbstick should be moved back close to neutral position
                // before it can be used again to rotate
                if (lastRotateValue > 0 && rotate < rotateResetThreshold) {
                    lastRotateValue = 0;
                } else if (lastRotateValue < 0 && rotate > -0.25) {
                    lastRotateValue = 0;
                }

                // if thumbstick is reset and moved enough to the side
                if (lastRotateValue === 0 && Math.abs(rotate) > rotateThreshold) {
                    lastRotateValue = Math.sign(rotate);

                    // we want to rotate relative to camera position
                    tmpVec3A.copy(c.getLocalPosition());
                    cameraParent.translateLocal(tmpVec3A);
                    cameraParent.rotateLocal(0, Math.sign(rotate) * rotateSpeed, 0);
                    cameraParent.translateLocal(tmpVec3A.mulScalar(-1));
                }
            }
        }

        // after movement and rotation is done
        // we update/render controllers
        for (i = 0; i < controllers.length; i++) {
            inputSource = controllers[i].inputSource;

            // render controller ray
            tmpVec3A.copy(inputSource.getOrigin());
            tmpVec3B.copy(inputSource.getDirection());
            tmpVec3B.mulScalar(100).add(tmpVec3A);
            app.drawLine(tmpVec3A, tmpVec3B, lineColor);

            // render controller
            if (inputSource.grip) {
                const pos = inputSource.getLocalPosition();
                // some controllers can be gripped
                controllers[i].model.enabled = true;
                controllers[i].setLocalPosition(pos);

                // Calculate the rotation to align with the VR controller ray
                const p1 = controllers[i].getPosition();
                const p2 = p1.clone().add(inputSource.getDirection().normalize());
                controllers[i].lookAt(p2, controllers[i].up);
            }
        }

        let meshHit: pc.MeshInstance = null;
        
        // visualize input source rays
        for (let i = 0; i < app.xr.input.inputSources.length; i++) {
            const inputSource = app.xr.input.inputSources[i];

            // draw ray
            if (inputSource.targetRayMode === pc.XRTARGETRAY_POINTER) {
                vec3A.copy(inputSource.getDirection()).mulScalar(10).add(inputSource.getOrigin());
                const color = inputSource.selecting ? pc.Color.RED : pc.Color.WHITE;
                app.drawLine(inputSource.getOrigin(), vec3A, color);
            }

            // Calculate pointer light positions
            if(i < pointerLights.length){ // Just in case number of input sources and pointer lights no longer match
                const pointerLight = pointerLights[i];
                // Calculate hit position for pointerLight from the input source
                let candidateDist: number = Infinity;
                ray.set(inputSource.getOrigin(), inputSource.getDirection());
                const raycastResult: CustomRaycastResult = raycast(ray, cameraParent, solids);
                if (raycastResult.meshHit) {
                    meshHit = raycastResult.meshHit;
                }
                if (meshHit) {
                    const hitPos = rayAABBIntersection(ray.origin, ray.direction, meshHit.aabb);
                    if (hitPos) {
                        pointerLight.setPosition(hitPos);
                        app.fire("cat:findNewTarget");
                    }
                }
            
                // Pointer light is on while pressing trigger
                pointerLight.setActive(inputSource.selecting && meshHit !== null);
            }
        }
        
    });
} else {
    message('WebXR is not supported');
}

export { app };