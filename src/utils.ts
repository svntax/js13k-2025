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