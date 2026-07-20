import { TAIL_LENGTH } from './ParticleLogic.js';
import * as THREE from 'three';

export class SharedRenderingCode {
    constructor(particles) {
        this.particles = particles;
        this.weights = [];
        for (let i = 0; i < TAIL_LENGTH; i++) {
            let iNormalized = 1.0 - i / (TAIL_LENGTH - 1);
            let brightness = Math.exp(-iNormalized * 2.0);
            let add = i == TAIL_LENGTH - 2 || i == TAIL_LENGTH - 1 ? 10.5 : 0.0;
            brightness += add;
            this.weights.push(brightness * 2.0);
        }
    }

    computeTrailPoints() {
        const points = [];
        const colors = [];

        for (const particle of this.particles) {
            const firstPoint = particle.oldPositions[(particle.newestIndex + TAIL_LENGTH - 1) % TAIL_LENGTH];
            points.push(new THREE.Vector3(firstPoint.x, firstPoint.y, firstPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
            points.push(new THREE.Vector3(firstPoint.x, firstPoint.y, firstPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
            for (let i = 0; i < TAIL_LENGTH - 1; i++) {
                let iCircular = (particle.newestIndex + TAIL_LENGTH - i);
                iCircular %= TAIL_LENGTH;
                let iPrevCircular = particle.newestIndex + TAIL_LENGTH - i - 1;
                iPrevCircular %= TAIL_LENGTH;
                let brightness = this.weights[TAIL_LENGTH - i - 1];
                let p1 = particle.oldPositions[iPrevCircular];
                let c1 = particle.oldColors[iPrevCircular];
                let p2 = particle.oldPositions[iCircular];
                let c2 = particle.oldColors[iCircular];
                const r = c2.r * brightness;
                const g = c2.g * brightness;
                const b = c2.b * brightness;

                //points.push(new THREE.Vector3(p1.x, p1.y, p1.z));
                //colors.push(new THREE.Color(r, g, b));
                points.push(new THREE.Vector3(p2.x, p2.y, p2.z));
                colors.push(new THREE.Color(r, g, b));
            }
            const lastPoint = points[points.length - 1];
            points.push(new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
            points.push(new THREE.Vector3(lastPoint.x, lastPoint.y, lastPoint.z));
            colors.push(new THREE.Color(0, 0, 0));
        }
        return { points, colors };
    }
}