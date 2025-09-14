import * as pc from "playcanvas";

export class FencePost {
    entity: pc.Entity;

    constructor(pos: pc.Vec3, rot: pc.Vec3, scale: pc.Vec3, containerResource: pc.ContainerResource) {
        const fencePost = containerResource.instantiateRenderEntity();
        fencePost.setPosition(pos);
        fencePost.setLocalEulerAngles(rot);
        fencePost.setLocalScale(scale);
        
        const fenceMaterial = new pc.StandardMaterial();
        fenceMaterial.diffuse = new pc.Color(0.988, 0.855, 0.565);
        fenceMaterial.update();
        // Source: https://forum.playcanvas.com/t/solved-how-do-i-change-a-models-material/25327/3
        // Apply to all mesh instances in all render components
        const renders = fencePost.findComponents('render');
        for (const render of renders) {
            for (const meshInstance of (render as pc.RenderComponent).meshInstances) {
                meshInstance.material = fenceMaterial;
            }
        }

        this.entity = fencePost;
    }
}