import * as THREE from 'three';

class PointSplatMaterial extends THREE.PointsMaterial {
    constructor(parameters) {
        super(parameters);
        this.glslVersion = THREE.GLSL3;

        this.onBeforeCompile = shader => {
            shader.fragmentShader = `
                uniform vec3 diffuse;
                uniform float opacity;

                in vec4 vColor;

                layout(location = 0) out vec4 outColor;
                layout(location = 1) out vec4 outNormal;

                void main() {
                    vec3 color = vColor.rgb;
                    
                    vec2 pointUv = gl_PointCoord * 2.0 - 1.0;
                    float distanceFromCenter = length(pointUv);
                    if (distanceFromCenter > 1.0) discard;

                    float alpha = pow(1.0 - distanceFromCenter, 3.0);
                    outColor = vec4(color, 0.0);

                    float normalZ = sqrt(1.0 - dot(pointUv, pointUv));
                    vec3 normal = normalize(vec3(pointUv, normalZ));
                    outNormal = vec4(normal * 0.5 + 0.5, 1.0);
                }
            `;
        };
    }
}

export { PointSplatMaterial };