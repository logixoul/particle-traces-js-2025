import * as THREE from 'three';

export function beveledLineNoOverlap(points, colors, widthFn) {
    // points: [{x,y,z},...] z is used only for width
    // widthFn: (z)=> width in world units
    const n = points.length;
    if (n < 2) return null;

    const w = points.map(p => widthFn(p.z));
    const segN = [];
    for (let i = 0; i < n - 1; i++) {
        const dx = points[i + 1].x - points[i].x;
        const dy = points[i + 1].y - points[i].y;
        const l = Math.hypot(dx, dy) || 1;
        segN[i] = { x: -dy / l, y: dx / l };
    }

    const verts = []; // x,y,z flat
    const vertsC = []; // x,y,z flat
    const idx = [];
    const add = (x, y, z, r, g, b) => { verts.push(x, y, z); vertsC.push(r, g, b); return verts.length / 3 - 1; };

    const n0 = segN[0];
    let prevL = add(points[0].x + n0.x * w[0] * 0.5, points[0].y + n0.y * w[0] * 0.5, points[0].z, colors[0].r, colors[0].g, colors[0].b);
    let prevR = add(points[0].x - n0.x * w[0] * 0.5, points[0].y - n0.y * w[0] * 0.5, points[0].z, colors[0].r, colors[0].g, colors[0].b);

    for (let i = 1; i < n - 1; i++) {
        const p = points[i];
        const nPrev = segN[i - 1], nNext = segN[i];
        const cPrev = colors[i - 1];
        const cross = nPrev.x * nNext.y - nPrev.y * nNext.x; // actually d0 x d1
        const dot = nPrev.x * nNext.x + nPrev.y * nNext.y;

        if (Math.abs(dot) > 0.9999) { // straight
            const L = add(p.x + nPrev.x * w[i] * 0.5, p.y + nPrev.y * w[i] * 0.5, p.z, cPrev.r, cPrev.g, cPrev.b);
            const R = add(p.x - nPrev.x * w[i] * 0.5, p.y - nPrev.y * w[i] * 0.5, p.z, cPrev.r, cPrev.g, cPrev.b);
            idx.push(prevL, prevR, L, prevR, R, L);
            prevL = L; prevR = R;
            continue;
        }

        // miter
        let mx = nPrev.x + nNext.x, my = nPrev.y + nNext.y;
        const mLen = Math.hypot(mx, my) || 1;
        mx /= mLen; my /= mLen;
        const cosHalf = mx * nPrev.x + my * nPrev.y; // = cos(theta/2)
        const miterLen = w[i] * 0.5 / cosHalf;

        const isLeft = cross > 0; // using dirs, but same sign as n's

        if (isLeft) {
            const inner = add(p.x + mx * miterLen, p.y + my * miterLen, p.z, cPrev.r, cPrev.g, cPrev.b);
            const outerA = add(p.x - nPrev.x * w[i] * 0.5, p.y - nPrev.y * w[i] * 0.5, p.z, cPrev.r, cPrev.g, cPrev.b);
            const outerB = add(p.x - nNext.x * w[i] * 0.5, p.y - nNext.y * w[i] * 0.5, p.z, cPrev.r, cPrev.g, cPrev.b);

            idx.push(prevL, prevR, inner);
            idx.push(prevR, outerA, inner);
            idx.push(inner, outerA, outerB); // bevel

            prevL = inner;
            prevR = outerB;
        } else {
            const inner = add(p.x + mx * miterLen, p.y + my * miterLen, p.z, cPrev.r, cPrev.g, cPrev.b);
            const outerA = add(p.x + nPrev.x * w[i] * 0.5, p.y + nPrev.y * w[i] * 0.5, p.z, cPrev.r, cPrev.g, cPrev.b);
            const outerB = add(p.x + nNext.x * w[i] * 0.5, p.y + nNext.y * w[i] * 0.5, p.z, cPrev.r, cPrev.g, cPrev.b);

            idx.push(prevL, prevR, outerA);
            idx.push(prevR, inner, outerA);
            idx.push(inner, outerB, outerA); // bevel, winding flipped

            prevL = outerB;
            prevR = inner;
        }
    }

    // last segment
    const last = points[n - 1];
    const nLast = segN[n - 2];
    const Lend = add(last.x + nLast.x * w[n - 1] * 0.5, last.y + nLast.y * w[n - 1] * 0.5, last.z, colors[n - 1].r, colors[n - 1].g, colors[n - 1].b);
    const Rend = add(last.x - nLast.x * w[n - 1] * 0.5, last.y - nLast.y * w[n - 1] * 0.5, last.z, colors[n - 1].r, colors[n - 1].g, colors[n - 1].b);
    idx.push(prevL, prevR, Lend, prevR, Rend, Lend);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertsC, 3));
    geo.setIndex(idx);
    geo.computeBoundingBox();
    return geo;
}

// widthFn exists only for backward compatibility, but is not used in this function.
export function myBeveledLineNoOverlap(points, colors, widthFn, camera) {
    // points: [{x,y,z},...] z is used only for width
    // widthFn: (z)=> width in world units
    const n = points.length;
    if (n < 2) return null;

    const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);

    camera.updateMatrixWorld();
    const mvpMatrix = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
    const pointsTransformed = points.map(p => {
        const pClipSpace = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(mvpMatrix);
        const pCameraSpace = new THREE.Vector4(p.x, p.y, p.z, 1).applyMatrix4(camera.matrixWorldInverse);
        return {
            clipSpace: new THREE.Vector3(pClipSpace.x / pClipSpace.w, pClipSpace.y / pClipSpace.w, pClipSpace.z / pClipSpace.w),
            cameraSpace: pCameraSpace
        }
    });

    const segN = [];
    for (let i = 0; i < n - 1; i++) {
        const dx = pointsTransformed[i + 1].clipSpace.x - pointsTransformed[i].clipSpace.x;
        const dy = pointsTransformed[i + 1].clipSpace.y - pointsTransformed[i].clipSpace.y;
        const l = Math.hypot(dx, dy) || 1;
        segN[i] = new THREE.Vector2(-dy / l, dx / l);
    }
    const pointN = [];
    pointN.push(new THREE.Vector3(segN[0].x, segN[0].y, 0.0));
    for (let i = 1; i < n - 1; i++) {
        const distance = -pointsTransformed[i].cameraSpace.z;
        const worldWidth = 0.01;
        const halfWidthNdcY = worldWidth / (2 * distance * Math.tan(halfFov));
        const halfWidthNdcX = halfWidthNdcY / camera.aspect;
        
        const nPrev = segN[i - 1], nNext = segN[i];
        const nAvg = nPrev.clone().add(nNext).normalize();
        pointN.push(nAvg.multiply(new THREE.Vector3(halfWidthNdcX, halfWidthNdcY, 0.0)));
    }
    pointN.push(new THREE.Vector3(segN[n - 2].x, segN[n - 2].y, 0.0));
    
    const verts = []; // x,y,z flat
    const vertsC = []; // x,y,z flat
    const idx = [];
    const add2 = (p, c) => { verts.push(p.x, p.y, p.z); vertsC.push(c.r, c.g, c.b); return verts.length / 3 - 1; };

    for (let i = 1; i < n; i++) {
        const pPrev = pointsTransformed[i - 1];
        const p = pointsTransformed[i];
        const cPrev = colors[i - 1];
        //const p1 = new THREE.Vector3(p.x - 0.01, p.y + 0.01, p.z);

        const beginLeft = pPrev.clipSpace.clone().sub(pointN[i - 1]);
        const beginRight = pPrev.clipSpace.clone().add(pointN[i - 1]);
        const endLeft = p.clipSpace.clone().sub(pointN[i]);
        const endRight = p.clipSpace.clone().add(pointN[i]);
        beginLeft.z = beginRight.z = endLeft.z = endRight.z = 0.0;
        
        let thisIdx;
        thisIdx = add2(beginLeft, cPrev);
        idx.push(thisIdx);
        thisIdx = add2(beginRight, cPrev);
        idx.push(thisIdx);
        thisIdx = add2(endRight, cPrev);
        idx.push(thisIdx);

        thisIdx = add2(beginLeft, cPrev);
        idx.push(thisIdx);
        thisIdx = add2(endLeft, cPrev);
        idx.push(thisIdx);
        thisIdx = add2(endRight, cPrev);
        idx.push(thisIdx);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(vertsC, 3));
    geo.setIndex(idx);
    //geo.computeBoundingBox();
    return geo;
}
