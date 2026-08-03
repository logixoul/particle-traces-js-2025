import * as SimplexNoise from 'simplex-noise';
import * as THREE from 'three';

const noise3D = SimplexNoise.createNoise3D();
function curlNoise3D(dstVector, x, y, z, noiseFn, eps = 1e-4) {
    // Partial derivatives using central differences
    const dx = eps, dy = eps, dz = eps;

    // Noise field components
    //const Fx = noiseFn(x, y, z);
    //const Fy = noiseFn(y + 100, z + 100, x + 100);
    //const Fz = noiseFn(z + 200, x + 200, y + 200);
    // dFz/dy
    const dFz_dy = (noiseFn(z + 200, x + 200, y + 200 + dy) - noiseFn(z + 200, x + 200, y + 200 - dy)) / (2 * dy);
    // dFy/dz
    const dFy_dz = (noiseFn(y + 100, z + 100 + dz, x + 100) - noiseFn(y + 100, z + 100 - dz, x + 100)) / (2 * dz);

    // dFx/dz
    const dFx_dz = (noiseFn(x, y, z + dz) - noiseFn(x, y, z - dz)) / (2 * dz);
    // dFz/dx
    const dFz_dx = (noiseFn(z + 200 + dx, x + 200, y + 200) - noiseFn(z + 200 - dx, x + 200, y + 200)) / (2 * dx);

    // dFy/dx
    const dFy_dx = (noiseFn(y + 100 + dx, z + 100, x + 100) - noiseFn(y + 100 - dx, z + 100, x + 100)) / (2 * dx);
    // dFx/dy
    const dFx_dy = (noiseFn(x, y + dy, z) - noiseFn(x, y - dy, z)) / (2 * dy);

    dstVector.set(
        dFz_dy - dFy_dz,
        dFx_dz - dFz_dx,
        dFy_dx - dFx_dy
    );
}
export const TAIL_LENGTH = 100;
const LIFESPAN = 1000;
export class Particle {
    constructor() {
        this.oldPositions = new Array(TAIL_LENGTH);
        this.oldColors = new Array(TAIL_LENGTH);
        for (let i = 0; i < TAIL_LENGTH; i++) {
            this.oldPositions[i] = new THREE.Vector3();
            this.oldColors[i] = new THREE.Color();
        }
        this.velocity = new THREE.Vector3();
        this.newestIndex = 0;
        this.reinit();
    }
    reinit() {
        this.age = 0;

        let positionRef = this.oldPositions[this.newestIndex];
        positionRef.set(Math.random(), Math.random(), Math.random());
        positionRef.subScalar(0.5);
        this.remainingLife = Math.floor(Math.random() * LIFESPAN);

        for (let i = 0; i < TAIL_LENGTH; i++) {
            this.update();
        }
    }
    IN_BOX = false;
    update() {
        let position = this.oldPositions[this.newestIndex];
        let colorRef = this.oldColors[this.newestIndex];

        this.newestIndex = (this.newestIndex + 1) % TAIL_LENGTH;
        let noiseScale = 0.3;
        if(this.IN_BOX) {
            noiseScale = 1.0;
        }
        curlNoise3D(this.velocity, position.x * noiseScale, position.y * noiseScale, position.z * noiseScale, noise3D);
        this.velocity.multiplyScalar(0.01);
        if(this.IN_BOX) {
            this.velocity.multiplyScalar(0.3);
        }
        const brightness = this.IN_BOX ? 0.1 : 1.0;
        colorRef.setHSL((Math.atan2(this.velocity.y, this.velocity.x) / Math.PI + 1) * .5, 1, 0.5* brightness);
        this.oldPositions[this.newestIndex].copy(position);
        this.oldPositions[this.newestIndex].add(this.velocity);

        if(this.IN_BOX) {
            this.oldPositions[this.newestIndex].x %= 1.0;
            this.oldPositions[this.newestIndex].y %= 1.0;
            this.oldPositions[this.newestIndex].z %= 1.0;
        }
        this.age++;
        this.remainingLife--;
    }
    dispose() {
        this.material.dispose();
    }
}
