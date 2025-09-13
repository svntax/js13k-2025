import * as pc from "playcanvas";
// Helper function to intersect ray with AABB
export function rayAABBIntersection(rayOrigin: pc.Vec3, rayDirection: pc.Vec3, aabb: pc.BoundingBox): pc.Vec3 | null {
    const min = aabb.getMin();
    const max = aabb.getMax();
    
    let tMin = (min.x - rayOrigin.x) / rayDirection.x;
    let tMax = (max.x - rayOrigin.x) / rayDirection.x;
    
    if (tMin > tMax) [tMin, tMax] = [tMax, tMin];
    
    let tyMin = (min.y - rayOrigin.y) / rayDirection.y;
    let tyMax = (max.y - rayOrigin.y) / rayDirection.y;
    
    if (tyMin > tyMax) [tyMin, tyMax] = [tyMax, tyMin];
    
    if (tMin > tyMax || tyMin > tMax) return null;
    
    if (tyMin > tMin) tMin = tyMin;
    if (tyMax < tMax) tMax = tyMax;
    
    let tzMin = (min.z - rayOrigin.z) / rayDirection.z;
    let tzMax = (max.z - rayOrigin.z) / rayDirection.z;
    
    if (tzMin > tzMax) [tzMin, tzMax] = [tzMax, tzMin];
    
    if (tMin > tzMax || tzMin > tMax) return null;
    
    if (tzMin > tMin) tMin = tzMin;
    
    // Return the intersection point
    if (tMin >= 0) {
        return new pc.Vec3()
            .copy(rayOrigin)
            .add(new pc.Vec3().copy(rayDirection).mulScalar(tMin));
    }
    
    return null;
}

export interface CustomRaycastResult {
    meshHit: pc.MeshInstance | undefined;
    distance: number;
}
export function raycast(ray: pc.Ray, camera: pc.Entity, objects: pc.Entity[]): CustomRaycastResult {
    let candidateDist: number = Infinity;
    let distanceToReturn = -1;
    let meshHit: pc.MeshInstance | undefined = undefined;
    for (let i = 0; i < objects.length; i++) {
        const mesh: pc.MeshInstance = objects[i].render.meshInstances[0];
        // check if mesh bounding box intersects with input source ray
        if (mesh.aabb.intersectsRay(ray)) {
            // check distance to camera
            const dist = mesh.aabb.center.distance(camera.getPosition());

            // if it is closer than previous distance
            if (dist < candidateDist) {
                // set new candidate
                meshHit = mesh;
                candidateDist = dist;
                distanceToReturn = candidateDist;
            }
        }
    }
    return {
        meshHit: meshHit,
        distance: distanceToReturn
    }
}

// Source: https://playcanvas.com/project/708598/overview
export function createTexture(app: pc.Application, size: number, topColor: pc.Color, bottomColor: pc.Color): pc.Texture {
    // Create a 4x4 RGB texture
    const texture = new pc.Texture(app.graphicsDevice, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_R8_G8_B8,
        addressU: pc.ADDRESS_CLAMP_TO_EDGE,
        addressV: pc.ADDRESS_CLAMP_TO_EDGE
    });

    // Define corner colors
    const topLeft = topColor;
    const topRight = topColor;
    const bottomRight = bottomColor;
    const bottomLeft = bottomColor;

    // Prepare to fill texture pixel data
    const pixels = texture.lock();
    let count = 0;

    const top = new pc.Color();
    const bottom = new pc.Color();
    const result = new pc.Color();

    // Fill pixels using bilinear interpolation
    for (let w = 0; w < size; w++) {
        for (let h = 0; h < size; h++) {
            const factorW = w / (size - 1);
            const factorH = h / (size - 1);

            top.lerp(topLeft, topRight, factorW);
            bottom.lerp(bottomLeft, bottomRight, factorW);
            result.lerp(top, bottom, factorH);

            pixels[count++] = result.r * 255;
            pixels[count++] = result.g * 255;
            pixels[count++] = result.b * 255;
        }
    }

    texture.unlock();

    return texture;
}