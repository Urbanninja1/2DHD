/**
 * GLSL helper functions for HD-2D surface detail injection.
 *
 * Three.js r182 uses WebGL2 but writes shader source in GLSL 1.0 style:
 *   - texture2D (becomes texture via #define)
 *   - varying (becomes in/out via #define)
 *   - texture2DGradEXT (becomes textureGrad via #define)
 *
 * Three layers:
 *   A) Triplanar detail normal (Ben Golus whiteout technique)
 *   B) Stochastic tiling breakup (Inigo Quilez hash technique)
 *   C) Grunge overlay (triplanar multiply blend)
 */

/**
 * Triplanar detail normal mapping.
 * Samples a high-frequency normal map from 3 world-space projections,
 * blended by surface normal. Returns a perturbation vector to add to
 * the existing surface normal.
 *
 * Based on Ben Golus's "Normal Mapping for Triplanar Shader" technique.
 * Sharpness=4.0 gives crisp transitions suitable for HD-2D camera angles.
 */
export const TRIPLANAR_DETAIL_NORMAL = /* glsl */`
vec3 triplanarDetailNormal(vec3 wPos, vec3 wNrm, sampler2D detMap, float scale) {
    vec3 blend = pow(abs(wNrm), vec3(4.0));
    blend /= (blend.x + blend.y + blend.z + 0.0001);

    vec3 tnX = texture2D(detMap, wPos.zy * scale).rgb * 2.0 - 1.0;
    vec3 tnY = texture2D(detMap, wPos.xz * scale).rgb * 2.0 - 1.0;
    vec3 tnZ = texture2D(detMap, wPos.xy * scale).rgb * 2.0 - 1.0;

    // Whiteout blend into world space
    vec3 nX = vec3(tnX.z * sign(wNrm.x), tnX.y, tnX.x);
    vec3 nY = vec3(tnY.x, tnY.z * sign(wNrm.y), tnY.y);
    vec3 nZ = vec3(tnZ.x, tnZ.y, tnZ.z * sign(wNrm.z));

    return normalize(nX * blend.x + nY * blend.y + nZ * blend.z) - wNrm;
}
`;

/**
 * Stochastic tiling (anti-tile repetition).
 * Replaces a single texture2D() call with 4 texture2DGradEXT() calls,
 * each sampling with a random UV offset and mirror/flip from a hash.
 * Eliminates visible tile repetition on large surfaces.
 *
 * Based on Inigo Quilez's "Texture Repetition" article.
 * texture2DGradEXT maps to textureGrad in GLSL 300 es via Three.js defines.
 */
export const STOCHASTIC_TILING = /* glsl */`
vec4 hash4(vec2 p) {
    return fract(sin(vec4(
        1.0 + dot(p, vec2(37.0, 17.0)),
        2.0 + dot(p, vec2(11.0, 47.0)),
        3.0 + dot(p, vec2(41.0, 29.0)),
        4.0 + dot(p, vec2(23.0, 31.0))
    )) * 103.0);
}

vec4 textureNoTile(sampler2D samp, vec2 uv) {
    ivec2 iuv = ivec2(floor(uv));
    vec2 fuv = fract(uv);

    vec4 ofa = hash4(vec2(iuv));
    vec4 ofb = hash4(vec2(iuv + ivec2(1, 0)));
    vec4 ofc = hash4(vec2(iuv + ivec2(0, 1)));
    vec4 ofd = hash4(vec2(iuv + ivec2(1, 1)));

    vec2 ddx = dFdx(uv);
    vec2 ddy = dFdy(uv);

    ofa.zw = sign(ofa.zw - 0.5);
    ofb.zw = sign(ofb.zw - 0.5);
    ofc.zw = sign(ofc.zw - 0.5);
    ofd.zw = sign(ofd.zw - 0.5);

    vec2 b = smoothstep(0.25, 0.75, fuv);

    return mix(
        mix(texture2DGradEXT(samp, uv * ofa.zw + ofa.xy, ddx * ofa.zw, ddy * ofa.zw),
            texture2DGradEXT(samp, uv * ofb.zw + ofb.xy, ddx * ofb.zw, ddy * ofb.zw), b.x),
        mix(texture2DGradEXT(samp, uv * ofc.zw + ofc.xy, ddx * ofc.zw, ddy * ofc.zw),
            texture2DGradEXT(samp, uv * ofd.zw + ofd.xy, ddx * ofd.zw, ddy * ofd.zw), b.x),
        b.y
    );
}
`;

/**
 * Grunge overlay — low-frequency dirt/wear map.
 * Triplanar-projected at large scale (typically 0.1 = 10m period).
 * Returns a single float in [0, 1] to multiply-blend onto diffuse color.
 */
export const GRUNGE_OVERLAY = /* glsl */`
float triplanarGrunge(vec3 wPos, vec3 wNrm, sampler2D grungeMap, float scale) {
    vec3 blend = pow(abs(wNrm), vec3(4.0));
    blend /= (blend.x + blend.y + blend.z + 0.0001);

    float gX = texture2D(grungeMap, wPos.zy * scale).r;
    float gY = texture2D(grungeMap, wPos.xz * scale).r;
    float gZ = texture2D(grungeMap, wPos.xy * scale).r;

    return gX * blend.x + gY * blend.y + gZ * blend.z;
}
`;
