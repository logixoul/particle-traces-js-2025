import * as THREE from 'three';

class PointSplatMaterial extends THREE.PointsMaterial {
    constructor(parameters) {
        super(parameters);
        this.glslVersion = THREE.GLSL3;

        this.onBeforeCompile = shader => {
            shader.vertexShader = `
                /*uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;*/
                uniform float size;
//                uniform float scale;

                in vec4 color4;
                out vec4 vColor;

                void main() {
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;

                    gl_PointSize = size * 30.0 / -mvPosition.z;

                    vColor = color4;
                }
            `;
            shader.fragmentShader = `
                uniform vec3 diffuse;
                uniform float opacity;

                in vec4 vColor;

                layout(location = 0) out vec4 outColor;
                layout(location = 1) out vec4 outNormal;

                void main() {
                    vec4 color = vColor;
                    //float colorMag = length(color);
                    //color *= (colorMag + 1.0) / (colorMag+0.00001);
                    
                    vec2 pointUv = gl_PointCoord * 2.0 - 1.0;
                    float distanceFromCenter = length(pointUv);
                    if(distanceFromCenter > 1.0) discard;

                    float alphaPunchy = color.a;
                    if(color.a > .9) alphaPunchy += 10.0;
                    outColor = vec4(color.rgb * alphaPunchy, 1.0);

                    float normalZ = sqrt(max(1.0 - dot(pointUv, pointUv), 0.0));
                    vec3 normal = normalize(vec3(pointUv, normalZ));
                    vec3 normal01 = normal * 0.5 + 0.5;
                    outNormal = vec4(normal01, 1.0);
                }
            `;
        };
    }
}

export { PointSplatMaterial };