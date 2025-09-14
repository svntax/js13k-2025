import * as pc from "playcanvas";

// Create a single cloud object
export const createSingleCloud = (): pc.Entity => {
    const cloud = new pc.Entity("Cloud");
    
    // Configuration for cloud appearance
    const baseSize = pc.math.random(1, 3);
    const heightLayers = Math.floor(pc.math.random(2, 4));
    const spheresPerLayer = Math.floor(pc.math.random(3, 6));
    const sphereSizeVariation = 0.3;
    
    const material = new pc.StandardMaterial();
    material.diffuse = new pc.Color(1, 1, 1);
    material.update();
    
    // Create multiple layers of spheres to form a cloud
    for (let layer = 0; layer < heightLayers; layer++) {
        const layerHeight = layer * 0.5;
        const layerScale = 1 - (layer * 0.2); // Higher layers are smaller
        
        for (let i = 0; i < spheresPerLayer; i++) {
            // Calculate position with some randomness
            const angle = (i / spheresPerLayer) * Math.PI * 2;
            const radius = (Math.random() * 0.5 + 0.5) * (layerScale * 1.5);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = layerHeight + Math.random() * 0.1;
            
            // Random scale variation
            const scaleVariation = 1 + (Math.random() - 0.5) * sphereSizeVariation;
            const size = baseSize * layerScale * scaleVariation;
            
            const sphere = new pc.Entity("CloudSphere");
            sphere.addComponent("model", {
                type: "sphere",
                castShadows: false
            });
            
            sphere.setLocalPosition(x, y, z);
            sphere.setLocalScale(size, size * 0.8, size); // Slightly flatten spheres
            sphere.model.material = material;
            
            cloud.addChild(sphere);
        }
    }
    
    return cloud;
};

export const generateClouds = (app: pc.Application, amount: number, pos: pc.Vec3) => {
    for (let i = 0; i < amount; i++) {
        const cloud = createSingleCloud();
        
        // Set random position around the given position with some variation
        const angle = (i / amount) * Math.PI * 2;
        const radius = 1 + Math.random() * 2;
        
        const cloudPos = new pc.Vec3(
            pos.x + Math.cos(angle) * radius,
            pos.y + Math.random() * 1,
            pos.z + Math.sin(angle) * radius
        );
        
        cloud.setPosition(cloudPos);
        app.root.addChild(cloud);
    }
};