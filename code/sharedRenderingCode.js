import { TAIL_LENGTH } from './ParticleLogic.js';
import * as THREE from 'three';

export class Vertex {
    constructor(position, color) {
        this.position = position;
        this.color = color;
    }
}

export class SharedRenderingCode {
    constructor(particles) {
        this.particles = particles;
        this.weights = [];
        for (let i = 0; i < TAIL_LENGTH; i++) {
            let iNormalized = i / (TAIL_LENGTH - 1);
            let brightness = iNormalized * iNormalized; // quadratic falloff
            //let add = i == TAIL_LENGTH - 2 || i == TAIL_LENGTH - 1 ? 20.5 : 0.0;
//            brightness += add;
            this.weights.push(brightness);
        }
    }

    computeTrailPoints() {
        const verts = [];
        
        for (const particle of this.particles) {
            for (let i = 0; i < TAIL_LENGTH - 1; i++) {
                let iCircular = (particle.newestIndex + TAIL_LENGTH - i);
                iCircular %= TAIL_LENGTH;
                let iPrevCircular = particle.newestIndex + TAIL_LENGTH - i - 1;
                iPrevCircular %= TAIL_LENGTH;
                let brightness = this.weights[TAIL_LENGTH - i - 1];
                //brightness = 1.0;
                let p1 = particle.oldPositions[iPrevCircular];
                let c1 = particle.oldColors[iPrevCircular];
                let p2 = particle.oldPositions[iCircular];
                let c2 = particle.oldColors[iCircular];
                /*const r = c2.r * brightness;
                const g = c2.g * brightness;
                const b = c2.b * brightness;*/
                const r = c2.r;
                const g = c2.g;
                const b = c2.b;

                //verts.push(new Vertex(new THREE.Vector3(p1.x, p1.y, p1.z), new THREE.Color(r, g, b)));
                verts.push(new Vertex(p2, new THREE.Vector4(r, g, b, brightness)));
            }
        }
        return verts;
    }
}