import * as pc from 'playcanvas';
import { VRButton } from './vr-button';
import { createText } from './create-text';
import { PointerLight } from './pointer-light';
import { rayAABBIntersection } from './utils';

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
    clearColor: new pc.Color(44 / 255, 62 / 255, 80 / 255),
    farClip: 10000
});
cameraParent.addChild(c);

const l = new pc.Entity();
l.addComponent('light', {
    type: 'spot',
    range: 30
});
l.translate(0, 10, 0);
app.root.addChild(l);

// Without ammo.js, we need to manually track all solid entities
const solids: pc.Entity[] = [];

/**
 * @param {number} x - The x coordinate.
 * @param {number} y - The y coordinate.
 * @param {number} z - The z coordinate.
 */
const createCube = function (x, y, z) {
    const cube = new pc.Entity();
    cube.addComponent('render', {
        type: 'box',
        material: new pc.StandardMaterial()
    });
    cube.setLocalScale(1, 1, 1);
    cube.translate(x, y, z);
    app.root.addChild(cube);
    solids.push(cube);
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
        type: 'cylinder'
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

// create a grid of cubes
const SIZE = 4;
for (let x = 0; x <= SIZE; x++) {
    for (let y = 0; y <= SIZE; y++) {
        createCube(2 * x - SIZE, -1.5, 2 * y - SIZE);
    }
}

// Create title screen
const screen = new pc.Entity("TitleScreen");
screen.setLocalScale(0.01, 0.01, 0.01);
screen.setPosition(0, 0, -2.5);
//screen.setLocalRotation(new Quat().setFromEulerAngles(-90, 0, 0));
screen.addComponent('screen', {
    referenceResolution: new pc.Vec2(1280, 720),
    screenSpace: false
});
app.root.addChild(screen);

// Title text
const titleEntity = createText(app, "Game Title", 0, 48, 200, 100, new pc.Color(), 36);
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
        console.log("Start game");
    }
});
screen.addChild(startButton.entity);

// Gameplay setup
let gameState = 0; // 0 = title, 1 = gameplay
const pointerLights: PointerLight[] = [];
let selectHeld = 0; // 1 = trigger held, 0 = no trigger held

if (app.xr.supported) {
    const activate = function () {
        if (app.xr.isAvailable(pc.XRTYPE_VR)) {
            c.camera.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCAL, {
                callback: function (err) {
                    if (err) message(`Immersive VR failed to start: ${err.message}`);
                }
            });
        } else {
            message('Immersive VR is not available');
        }
    };

    app.mouse.on('mousedown', () => {
        if (!app.xr.active) activate();
    });

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
                for (let i = 0; i < solids.length; i++) {
                    const mesh: pc.MeshInstance = solids[i].render.meshInstances[0];
                    // check if mesh bounding box intersects with input source ray
                    ray.set(inputSource.getOrigin(), inputSource.getDirection());
                    if (mesh.aabb.intersectsRay(ray)) {
                        // check distance to camera
                        const dist = mesh.aabb.center.distance(c.getPosition());
    
                        // if it is closer than previous distance
                        if (dist < candidateDist) {
                            // set new candidate
                            meshHit = mesh;
                            candidateDist = dist;
                        }
                    }
                }
                if (meshHit) {
                    const hitPos = rayAABBIntersection(ray.origin, ray.direction, meshHit.aabb);
                    if (hitPos) {
                        pointerLight.setPosition(hitPos);
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