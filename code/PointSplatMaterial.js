import * as THREE from 'three';

class PointSplatMaterial extends THREE.PointsMaterial {
    constructor(parameters) {
        super(parameters);

        this.onBeforeCompile = shader => {
            shader.fragmentShader = shader.fragmentShader.replace(/\n}\s*$/, `
                vec2 uv = gl_PointCoord.xy;
                float dist = length(uv - vec2(0.5));
                if (dist > 0.5) discard;
                dist *= 2.0; // scale to [0,1]
                gl_FragColor.a *= smoothstep(0.0, 1.0, 1.0 - dist);
            }
            `);
        };
    }
}

export { PointSplatMaterial };