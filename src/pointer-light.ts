import * as pc from "playcanvas";

export class PointerLight {
    public entity: pc.Entity;
    private lightComponent: pc.LightComponent;
    private sphereEntity: pc.Entity;
    private isActive: boolean = false;

    constructor(app: pc.Application) {
        this.entity = new pc.Entity("PointerLight");
        
        // Light component
        this.entity.addComponent("light", {
            type: "omni",
            color: new pc.Color(1, 0, 0),
            intensity: 20,
            range: 0.25,
            castShadows: false,
            falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED
        });
        this.lightComponent = this.entity.light!;
        
        // Small sphere
        this.sphereEntity = new pc.Entity("PointerLightSphere");
        this.sphereEntity.addComponent("model", {
            type: "sphere"
        });
        this.sphereEntity.setLocalScale(0.1, 0.1, 0.1);
        
        // Set sphere material to red
        const redMaterial = new pc.StandardMaterial();
        redMaterial.emissive = pc.Color.RED;
        redMaterial.useLighting = false;
        redMaterial.update();
        this.sphereEntity.model!.material = redMaterial;
        
        this.entity.addChild(this.sphereEntity);
        
        app.root.addChild(this.entity);
        
        // Hide by default
        this.setVisible(false);
    }

    setPosition(position: pc.Vec3) {
        this.entity.setLocalPosition(position);
    }

    setActive(active: boolean) {
        if (this.isActive !== active) {
            this.isActive = active;
            this.setVisible(active);
        }
    }

    getActive(): boolean {
        return this.isActive;
    }

    private setVisible(visible: boolean) {
        this.entity.enabled = visible;
    }

    destroy() {
        if (this.entity && this.entity.parent) {
            this.entity.parent.removeChild(this.entity);
        }
        this.entity.destroy();
    }
}