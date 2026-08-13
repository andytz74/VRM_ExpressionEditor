# VRM Expression Editor Meta Integration Notes

This document describes the latest character meta fields that the extension runtime should consume.

## 1. Extra Bone Follow Setting

Purpose:

Extra bones that are not VRM humanoid bones can follow a selected humanoid bone rotation. This is mainly for clothes or sleeve helper bones. The current use case is reducing shoulder/sleeve distortion by following upper arm swing while suppressing upper arm twist.

Meta location:

```json
{
  "extraBoneFollowSettings": [
    {
      "id": "extra-bone-...",
      "targetBone": "J_Sec_L_Sleeve",
      "sourceBone": "leftUpperArm",
      "tailDirectionBone": "leftLowerArm",
      "swingFactor": 1,
      "twistFactor": 0
    }
  ]
}
```

Field meanings:

- `targetBone`: Extra bone node name to modify, for example `J_Sec_L_Sleeve`.
- `sourceBone`: VRM humanoid bone key whose rotation is followed, for example `leftUpperArm`.
- `tailDirectionBone`: VRM humanoid bone key used as the target tail direction, for example `leftLowerArm`.
- `swingFactor`: How much directional rotation is applied. Typical value is `1`.
- `twistFactor`: How much twist around the bone length axis is applied. Sleeve helper bones usually use `0`.

Apply timing:

```text
Every frame:
1. Update VRMA animation.
2. Apply existing motion correction.
3. Apply extraBoneFollowSettings.
4. Render.
```

This must be applied every frame because the source bone rotation changes with animation.

Implementation concept:

```js
for (const setting of meta.extraBoneFollowSettings ?? []) {
  const target = findBoneByName(vrm.scene, setting.targetBone);
  const source = vrm.humanoid.getRawBoneNode(setting.sourceBone);
  const tail = vrm.humanoid.getRawBoneNode(setting.tailDirectionBone);

  if (!target || !source) continue;

  const sourceWorldQ = source.getWorldQuaternion(new THREE.Quaternion());
  const parentWorldQ = target.parent
    ? target.parent.getWorldQuaternion(new THREE.Quaternion())
    : new THREE.Quaternion();

  const localQ = target.parent
    ? parentWorldQ.invert().multiply(sourceWorldQ)
    : sourceWorldQ;

  const resultQ = applySwingTwist(
    localQ,
    new THREE.Vector3(0, 1, 0),
    setting.swingFactor ?? 1,
    setting.twistFactor ?? 0
  );

  target.quaternion.copy(resultQ);

  if (tail) {
    alignTailDirection(target, tail);
  }
}
```

Old meta may still contain `axes` or `rotationOrder`. The current runtime should use `swingFactor` and `twistFactor`.

## 2. Material Outline Color

Purpose:

The extension should overwrite MToon material outline colors from character meta after VRM load.

Meta location:

```json
{
  "materialSettings": {
    "outline": {
      "materials": {
        "N00_000_00_Face_00_SKIN": {
          "color": "#2a1a1a"
        },
        "N00_000_00_Hair_00_HAIR": {
          "color": "#111111"
        }
      },
      "hiddenMaterials": [],
      "includedMaterials": [],
      "showAll": false
    }
  }
}
```

Runtime should consume:

```js
meta.materialSettings?.outline?.materials
```

The following fields are editor UI state and may be ignored by the extension runtime:

- `hiddenMaterials`
- `includedMaterials`
- `showAll`

Apply timing:

```text
Apply once after VRM load.
```

This does not need to run every frame.

Implementation concept:

```js
const outlineMaterials = meta.materialSettings?.outline?.materials ?? {};

vrm.scene.traverse((object) => {
  if (!object.isMesh || !object.material) return;

  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];

  for (const material of materials) {
    const setting = outlineMaterials[material.name];
    if (!setting?.color) continue;

    applyMtoonOutlineColor(material, setting.color);
  }
});
```

MToon outline color application example:

```js
function applyMtoonOutlineColor(material, hexColor) {
  const color = new THREE.Color(hexColor);

  if (material.outlineColorFactor?.isColor) {
    material.outlineColorFactor.copy(color);
  }

  if (material.uniforms?.outlineColorFactor?.value?.isColor) {
    material.uniforms.outlineColorFactor.value.copy(color);
  }

  material.needsUpdate = true;
}
```

## Runtime Order Summary

```text
On character load:
1. Load VRM.
2. Load character meta.
3. Apply materialSettings.outline.materials.
4. Apply initial animation / expression state.

Every frame:
1. Update animation mixer.
2. Apply motion correction.
3. Apply extraBoneFollowSettings.
4. Apply expression / blink state.
5. Render.
```
