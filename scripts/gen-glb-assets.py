#!/usr/bin/env python3
"""
Generate procedural GLB assets for NJ MMO (Phase 10 + Phase 15 fixes).

Outputs:
  Static props (no skeleton, no animations, no creature bones):
    client/public/models/props/environment/Building_0.glb  -- small shop
    client/public/models/props/environment/Building_1.glb  -- medium house
    client/public/models/props/environment/Building_2.glb  -- tower
    client/public/models/props/environment/Building_3.glb  -- wide barn
    client/public/models/props/environment/Building_4.glb  -- large inn
    client/public/models/props/environment/Tree.glb        -- trunk + foliage cone
    client/public/models/props/environment/Rock.glb        -- rock cluster
    client/public/models/props/environment/PeaceMarker.glb -- golden pillar

  Rigged humanoids (skeleton + animations, unique per creature):
    client/public/models/monsters/Gremlin.glb  -- small imp-like biped, greenish
    client/public/models/monsters/Goblin.glb   -- stocky short biped, dark green

Usage:
    python3 scripts/gen-glb-assets.py
"""

import math
import pathlib
import struct
import numpy as np
import pygltflib
from pygltflib import (
    GLTF2, Buffer, BufferView, Accessor, Mesh, Primitive,
    Material, PbrMetallicRoughness, Node, Scene, Asset,
    Animation, AnimationChannel, AnimationChannelTarget, AnimationSampler,
    Skin,
)

# Paths
REPO_ROOT = pathlib.Path(__file__).parent.parent
ENV_DIR = REPO_ROOT / "client/public/models/props/environment"
MON_DIR = REPO_ROOT / "client/public/models/monsters"

# GLTF component type constants
GLTF_FLOAT          = 5126  # float32
GLTF_UNSIGNED_SHORT = 5123  # uint16
GLTF_UNSIGNED_BYTE  = 5121  # uint8
# GLTF buffer target constants
ARRAY_BUFFER         = 34962
ELEMENT_ARRAY_BUFFER = 34963

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _align4(n: int) -> int:
    return (n + 3) & ~3


class BlobBuilder:
    """Accumulates binary data in a single buffer, 4-byte aligned between parts."""

    def __init__(self):
        self._parts: list[bytes] = []
        self._offset: int = 0

    def add(self, data: bytes) -> tuple[int, int]:
        """Append data (padded to 4-byte boundary). Returns (byte_offset, real_length)."""
        offset = self._offset
        length = len(data)
        padded = _align4(length)
        self._parts.append(data + b'\x00' * (padded - length))
        self._offset += padded
        return offset, length

    def build(self) -> bytes:
        return b''.join(self._parts)


def _flat_box(w: float, h: float, d: float):
    """
    Flat-shaded axis-aligned box.  Origin = base-center (y=0 is floor, y=h top).
    Returns (positions float32 Nx3, normals float32 Nx3, indices uint16).
    """
    hw, hd = w / 2, d / 2
    # Each face: 4 verts (CCW from outside), flat normal
    face_specs = [
        # top
        ([[-hw, h, -hd], [hw, h, -hd], [hw, h, hd], [-hw, h, hd]], [0, 1, 0]),
        # bottom
        ([[-hw, 0, hd], [hw, 0, hd], [hw, 0, -hd], [-hw, 0, -hd]], [0, -1, 0]),
        # +X right
        ([[hw, 0, -hd], [hw, h, -hd], [hw, h, hd], [hw, 0, hd]], [1, 0, 0]),
        # -X left
        ([[-hw, 0, hd], [-hw, h, hd], [-hw, h, -hd], [-hw, 0, -hd]], [-1, 0, 0]),
        # +Z front
        ([[-hw, 0, hd], [hw, 0, hd], [hw, h, hd], [-hw, h, hd]], [0, 0, 1]),
        # -Z back
        ([[-hw, 0, -hd], [-hw, h, -hd], [hw, h, -hd], [hw, 0, -hd]], [0, 0, -1]),
    ]
    pos, nrm, idx = [], [], []
    base = 0
    for verts, n in face_specs:
        pos.extend(verts)
        nrm.extend([n] * 4)
        idx += [base, base+1, base+2, base, base+2, base+3]
        base += 4
    return (np.array(pos, np.float32),
            np.array(nrm, np.float32),
            np.array(idx, np.uint16))


def _translate(pos: np.ndarray, tx: float, ty: float, tz: float) -> np.ndarray:
    return pos + np.array([tx, ty, tz], np.float32)


def _flat_wedge(w: float, h: float, d: float):
    """
    Triangular-prism roof wedge. Ridge runs along Z. Base at y=0, apex at y=h.
    Origin at base-center.
    """
    hw, hd = w / 2, d / 2
    pos, nrm, idx = [], [], []

    # Front gable (-Z)
    b = len(pos)
    pos += [[-hw, 0, -hd], [hw, 0, -hd], [0, h, -hd]]
    nrm += [[0, 0, -1]] * 3
    idx += [b, b+2, b+1]

    # Back gable (+Z)
    b = len(pos)
    pos += [[-hw, 0, hd], [hw, 0, hd], [0, h, hd]]
    nrm += [[0, 0, 1]] * 3
    idx += [b, b+1, b+2]

    # Left slope (-X side): verts at (-hw,0,-hd) (-hw,0,hd) (0,h,hd) (0,h,-hd)
    slant = math.sqrt(h*h + (hw*hw))
    nx_l = -h / slant
    ny_l = hw / slant
    b = len(pos)
    pos += [[-hw, 0, -hd], [-hw, 0, hd], [0, h, hd], [0, h, -hd]]
    nrm += [[nx_l, ny_l, 0]] * 4
    idx += [b, b+1, b+2, b, b+2, b+3]

    # Right slope (+X side)
    b = len(pos)
    pos += [[hw, 0, hd], [hw, 0, -hd], [0, h, -hd], [0, h, hd]]
    nrm += [[-nx_l, ny_l, 0]] * 4
    idx += [b, b+1, b+2, b, b+2, b+3]

    # Bottom
    b = len(pos)
    pos += [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd]]
    nrm += [[0, -1, 0]] * 4
    idx += [b, b+3, b+2, b, b+2, b+1]

    return (np.array(pos, np.float32),
            np.array(nrm, np.float32),
            np.array(idx, np.uint16))


def _flat_cylinder(radius: float, height: float, segs: int = 10):
    """Flat-shaded cylinder. Base at y=0."""
    pos, nrm, idx = [], [], []
    step = 2 * math.pi / segs
    angles = [i * step for i in range(segs)]
    cx = [math.cos(a) * radius for a in angles]
    cz = [math.sin(a) * radius for a in angles]

    # Side quads
    for i in range(segs):
        j = (i + 1) % segs
        mid = (angles[i] + angles[j]) / 2
        nx, nz = math.cos(mid), math.sin(mid)
        b = len(pos)
        pos += [[cx[i], 0, cz[i]], [cx[j], 0, cz[j]], [cx[j], height, cz[j]], [cx[i], height, cz[i]]]
        nrm += [[nx, 0, nz]] * 4
        idx += [b, b+1, b+2, b, b+2, b+3]

    # Top cap (fan)
    tc = len(pos)
    pos.append([0, height, 0]); nrm.append([0, 1, 0])
    for i in range(segs):
        j = (i + 1) % segs
        b = len(pos)
        pos += [[cx[i], height, cz[i]], [cx[j], height, cz[j]]]
        nrm += [[0, 1, 0], [0, 1, 0]]
        idx += [tc, b, b+1]

    # Bottom cap (fan, reversed winding)
    bc = len(pos)
    pos.append([0, 0, 0]); nrm.append([0, -1, 0])
    for i in range(segs):
        j = (i + 1) % segs
        b = len(pos)
        pos += [[cx[i], 0, cz[i]], [cx[j], 0, cz[j]]]
        nrm += [[0, -1, 0], [0, -1, 0]]
        idx += [bc, b+1, b]

    return (np.array(pos, np.float32),
            np.array(nrm, np.float32),
            np.array(idx, np.uint16))


def _flat_cone(radius: float, height: float, segs: int = 10):
    """Flat-shaded cone. Base at y=0, tip at y=height."""
    pos, nrm, idx = [], [], []
    step = 2 * math.pi / segs
    angles = [i * step for i in range(segs)]
    cx = [math.cos(a) * radius for a in angles]
    cz = [math.sin(a) * radius for a in angles]
    tip = [0, height, 0]
    slant = math.sqrt(radius * radius + height * height)

    for i in range(segs):
        j = (i + 1) % segs
        mid = (angles[i] + angles[j]) / 2
        nx, nz = math.cos(mid) * height / slant, math.sin(mid) * height / slant
        ny = radius / slant
        b = len(pos)
        pos += [[cx[i], 0, cz[i]], [cx[j], 0, cz[j]], tip]
        nrm += [[nx, ny, nz]] * 3
        idx += [b, b+1, b+2]

    # Bottom cap
    bc = len(pos)
    pos.append([0, 0, 0]); nrm.append([0, -1, 0])
    for i in range(segs):
        j = (i + 1) % segs
        b = len(pos)
        pos += [[cx[i], 0, cz[i]], [cx[j], 0, cz[j]]]
        nrm += [[0, -1, 0], [0, -1, 0]]
        idx += [bc, b+1, b]

    return (np.array(pos, np.float32),
            np.array(nrm, np.float32),
            np.array(idx, np.uint16))


# ---------------------------------------------------------------------------
# Static GLB builder (environment props)
# ---------------------------------------------------------------------------

def _build_static_glb(output_path: pathlib.Path,
                       mesh_name: str,
                       submeshes: list[tuple]):
    """
    submeshes: list of (positions f32 Nx3, normals f32 Nx3, indices u16, (r,g,b,a))
    Produces a valid static GLB with no skeleton and no animations.
    """
    blob = BlobBuilder()
    bufferViews = []
    accessors = []
    materials = []
    primitives = []

    def _bv(data: bytes, target: int) -> int:
        off, ln = blob.add(data)
        bufferViews.append(BufferView(buffer=0, byteOffset=off,
                                       byteLength=ln, target=target))
        return len(bufferViews) - 1

    def _acc(bv_idx: int, comp_type: int, count: int, vec_type: str,
             mn=None, mx=None) -> int:
        acc = Accessor(bufferView=bv_idx, byteOffset=0,
                       componentType=comp_type, count=count, type=vec_type)
        if mn is not None:
            acc.min = [float(x) for x in mn]
        if mx is not None:
            acc.max = [float(x) for x in mx]
        accessors.append(acc)
        return len(accessors) - 1

    for pos, nrm, idx, color in submeshes:
        mat_idx = len(materials)
        materials.append(Material(
            pbrMetallicRoughness=PbrMetallicRoughness(
                baseColorFactor=list(color),
                metallicFactor=0.0,
                roughnessFactor=0.85,
            ),
            name=f"{mesh_name}_mat{mat_idx}",
        ))
        pos_acc = _acc(_bv(pos.tobytes(), ARRAY_BUFFER),
                       GLTF_FLOAT, len(pos), "VEC3",
                       pos.min(axis=0).tolist(), pos.max(axis=0).tolist())
        nrm_acc = _acc(_bv(nrm.tobytes(), ARRAY_BUFFER),
                       GLTF_FLOAT, len(nrm), "VEC3")
        idx_acc = _acc(_bv(idx.tobytes(), ELEMENT_ARRAY_BUFFER),
                       GLTF_UNSIGNED_SHORT, len(idx), "SCALAR")
        primitives.append(Primitive(
            attributes={"POSITION": pos_acc, "NORMAL": nrm_acc},
            indices=idx_acc,
            material=mat_idx,
        ))

    binary = blob.build()
    gltf = GLTF2()
    gltf.asset = Asset(version="2.0", generator="NJ-MMO prop generator v1")
    gltf.buffers = [Buffer(byteLength=len(binary))]
    gltf.bufferViews = bufferViews
    gltf.accessors = accessors
    gltf.materials = materials
    gltf.meshes = [Mesh(name=mesh_name, primitives=primitives)]
    gltf.nodes = [Node(mesh=0, name=mesh_name)]
    gltf.scenes = [Scene(nodes=[0])]
    gltf.scene = 0
    gltf.set_binary_blob(binary)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    gltf.save_binary(str(output_path))
    size = output_path.stat().st_size
    print(f"  [PROP]  {output_path.name}  ({size // 1024} KB, {len(primitives)} primitives)")


# ---------------------------------------------------------------------------
# Rigged humanoid GLB builder (Gremlin / Goblin)
# ---------------------------------------------------------------------------

def _quat(axis: str, deg: float) -> list[float]:
    """Unit quaternion for rotation around axis ('x','y','z') by deg degrees. [x,y,z,w]"""
    r = math.radians(deg) / 2
    s = math.sin(r)
    c = math.cos(r)
    if axis == 'x': return [s, 0, 0, c]
    if axis == 'y': return [0, s, 0, c]
    return [0, 0, s, c]


def _ibm(wx: float, wy: float, wz: float) -> list[float]:
    """
    Inverse bind matrix for a joint at world position (wx, wy, wz), no rotation.
    GLTF column-major mat4: [m0..m15]
    """
    return [1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            -wx, -wy, -wz, 1]


def _build_humanoid_glb(output_path: pathlib.Path,
                         creature_name: str,
                         body_color: tuple,
                         head_color: tuple,
                         overall_height: float = 1.15):
    """
    Generates a minimal rigged biped GLB with 7 joints and 4 animation clips:
      Idle (2s) — head nods
      Walk (1s) — arms + legs swing
      Attack (0.8s) — right arm swings forward
      Death (1.5s) — root falls and rotates

    Skeleton (world positions, bind pose):
      Joint 0 Root    (0,       0,    0)   — controls hips + legs
      Joint 1 Torso   (0,    0.50,    0)   — controls torso
      Joint 2 Head    (0,    0.95,    0)   — controls head
      Joint 3 ArmL   (-0.28, 0.65,    0)   — controls left arm
      Joint 4 ArmR   (+0.28, 0.65,    0)   — controls right arm
      Joint 5 LegL   (-0.10, 0,       0)   — controls left leg
      Joint 6 LegR   (+0.10, 0,       0)   — controls right leg

    All dimensions scaled by `overall_height / 1.15`.
    """
    scale = overall_height / 1.15
    s = scale  # shorthand

    # --- joint world positions (used for IBM and mesh vertex placement) ---
    J = {
        'Root':  (0,      0,     0),
        'Torso': (0,      0.50*s, 0),
        'Head':  (0,      0.95*s, 0),
        'ArmL':  (-0.28*s, 0.65*s, 0),
        'ArmR':  (+0.28*s, 0.65*s, 0),
        'LegL':  (-0.10*s, 0,     0),
        'LegR':  (+0.10*s, 0,     0),
    }
    JOINT_ORDER = ['Root', 'Torso', 'Head', 'ArmL', 'ArmR', 'LegL', 'LegR']
    joint_idx = {name: i for i, name in enumerate(JOINT_ORDER)}  # name → joint index

    # --- body-part geometry (box at world-center, assigned to one joint) ---
    # Each entry: (w, h, d, cx, cy, cz, joint_name, color)
    parts = [
        # hips/pelvis
        (0.36*s, 0.18*s, 0.22*s, 0,       0.47*s, 0, 'Root',  body_color),
        # left leg
        (0.14*s, 0.42*s, 0.14*s, -0.10*s, 0.22*s, 0, 'LegL',  body_color),
        # right leg
        (0.14*s, 0.42*s, 0.14*s,  0.10*s, 0.22*s, 0, 'LegR',  body_color),
        # torso
        (0.40*s, 0.42*s, 0.22*s, 0,       0.72*s, 0, 'Torso', body_color),
        # head
        (0.28*s, 0.28*s, 0.28*s, 0,       1.05*s, 0, 'Head',  head_color),
        # left arm
        (0.13*s, 0.38*s, 0.13*s, -0.35*s, 0.67*s, 0, 'ArmL',  body_color),
        # right arm
        (0.13*s, 0.38*s, 0.13*s,  0.35*s, 0.67*s, 0, 'ArmR',  body_color),
    ]

    # --- build combined mesh (all parts, flat-shaded) ---
    all_pos, all_nrm, all_idx = [], [], []
    all_joints, all_weights = [], []
    vert_offset = 0

    for (w, h, d, cx, cy, cz, joint_name, _color) in parts:
        p, n, idx = _flat_box(w, h, d)
        # shift so box center (horizontally) is at (cx, cy, cz)
        # _flat_box origin is bottom-center: shift by (cx, cy - h/2, cz)
        p = _translate(p, cx, cy - h/2, cz)
        all_pos.append(p)
        all_nrm.append(n)
        all_idx.append(idx + vert_offset)
        ji = joint_idx[joint_name]
        for _ in range(len(p)):
            all_joints.append([ji, 0, 0, 0])
            all_weights.append([1.0, 0.0, 0.0, 0.0])
        vert_offset += len(p)

    pos_arr = np.concatenate(all_pos, axis=0).astype(np.float32)
    nrm_arr = np.concatenate(all_nrm, axis=0).astype(np.float32)
    idx_arr = np.concatenate(all_idx, axis=0).astype(np.uint16)
    jnt_arr = np.array(all_joints, dtype=np.uint8)
    wgt_arr = np.array(all_weights, dtype=np.float32)

    # --- single material (body color; head color handled per-prim later) ---
    # For simplicity, all parts share body_color material here (subtle difference in
    # the mesh itself makes the head shape visible; no need for per-part materials
    # in a single combined skin mesh).
    r, g, b, a = body_color

    # --- build GLTF ---
    blob = BlobBuilder()
    bufferViews = []
    accessors = []

    def _bv(data: bytes, target: int) -> int:
        off, ln = blob.add(data)
        bufferViews.append(BufferView(buffer=0, byteOffset=off,
                                       byteLength=ln, target=target))
        return len(bufferViews) - 1

    def _acc(bv_idx: int, comp_type: int, count: int, vec_type: str,
             mn=None, mx=None) -> int:
        acc = Accessor(bufferView=bv_idx, byteOffset=0,
                       componentType=comp_type, count=count, type=vec_type)
        if mn is not None:
            acc.min = [float(x) for x in mn]
        if mx is not None:
            acc.max = [float(x) for x in mx]
        accessors.append(acc)
        return len(accessors) - 1

    pos_acc  = _acc(_bv(pos_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_FLOAT, len(pos_arr), "VEC3",
                    pos_arr.min(axis=0).tolist(), pos_arr.max(axis=0).tolist())
    nrm_acc  = _acc(_bv(nrm_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_FLOAT, len(nrm_arr), "VEC3")
    idx_acc  = _acc(_bv(idx_arr.tobytes(), ELEMENT_ARRAY_BUFFER),
                    GLTF_UNSIGNED_SHORT, len(idx_arr), "SCALAR")
    jnt_acc  = _acc(_bv(jnt_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_UNSIGNED_BYTE, len(jnt_arr), "VEC4")
    wgt_acc  = _acc(_bv(wgt_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_FLOAT, len(wgt_arr), "VEC4")

    # Inverse bind matrices for all 7 joints (MAT4 column-major)
    ibm_data = []
    for name in JOINT_ORDER:
        wx, wy, wz = J[name]
        ibm_data.extend(_ibm(wx, wy, wz))
    ibm_arr = np.array(ibm_data, dtype=np.float32)
    ibm_acc = _acc(_bv(ibm_arr.tobytes(), ARRAY_BUFFER),
                   GLTF_FLOAT, len(JOINT_ORDER), "MAT4")

    # -----------------------------------------------------------------------
    # Animation data helpers
    # -----------------------------------------------------------------------

    def _anim_timestamps(times: list[float]) -> int:
        """Store float32 timestamps; returns accessor index."""
        t_arr = np.array(times, dtype=np.float32)
        return _acc(_bv(t_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_FLOAT, len(times), "SCALAR",
                    mn=[times[0]], mx=[times[-1]])

    def _anim_rotations(quats: list[list[float]]) -> int:
        """Store VEC4 quaternions [x,y,z,w]; returns accessor index."""
        q_arr = np.array(quats, dtype=np.float32)
        return _acc(_bv(q_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_FLOAT, len(quats), "VEC4")

    def _anim_translations(vecs: list[list[float]]) -> int:
        """Store VEC3 translations; returns accessor index."""
        v_arr = np.array(vecs, dtype=np.float32)
        return _acc(_bv(v_arr.tobytes(), ARRAY_BUFFER),
                    GLTF_FLOAT, len(vecs), "VEC3")

    def _channel(sampler_idx: int, node_idx: int, path: str) -> AnimationChannel:
        return AnimationChannel(
            sampler=sampler_idx,
            target=AnimationChannelTarget(node=node_idx, path=path),
        )

    def _sampler(input_acc: int, output_acc: int,
                 interp: str = "LINEAR") -> AnimationSampler:
        return AnimationSampler(input=input_acc, output=output_acc,
                                interpolation=interp)

    IDENTITY_QUAT = [0, 0, 0, 1]

    # Node indices reference (defined below, but we need them for animation targets)
    # Node 0 = mesh node
    # Node 1 = Root (joint 0)
    # Node 2 = Torso (joint 1)
    # Node 3 = Head (joint 2)
    # Node 4 = ArmL (joint 3)
    # Node 5 = ArmR (joint 4)
    # Node 6 = LegL (joint 5)
    # Node 7 = LegR (joint 6)
    N_ROOT  = 1
    N_TORSO = 2
    N_HEAD  = 3
    N_ARML  = 4
    N_ARMR  = 5
    N_LEGL  = 6
    N_LEGR  = 7

    # -----------------------------------------------------------------------
    # Clip: Idle (2 s, loop) — head nods gently
    # -----------------------------------------------------------------------
    idle_times = _anim_timestamps([0.0, 0.5, 1.0, 1.5, 2.0])
    idle_head_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('x', -6),
        IDENTITY_QUAT,
        _quat('x', 4),
        IDENTITY_QUAT,
    ])
    # Torso slight breathing scale
    idle_torso_t = _anim_translations([
        [0, 0.50*s, 0],
        [0, 0.515*s, 0],
        [0, 0.50*s, 0],
        [0, 0.505*s, 0],
        [0, 0.50*s, 0],
    ])
    idle_samp0 = _sampler(idle_times, idle_head_r)
    idle_samp1 = _sampler(idle_times, idle_torso_t)
    anim_idle = Animation(
        name="Idle",
        samplers=[idle_samp0, idle_samp1],
        channels=[
            _channel(0, N_HEAD,  "rotation"),
            _channel(1, N_TORSO, "translation"),
        ],
    )

    # -----------------------------------------------------------------------
    # Clip: Walk (1 s, loop) — legs/arms swing
    # -----------------------------------------------------------------------
    walk_times = _anim_timestamps([0.0, 0.25, 0.5, 0.75, 1.0])
    walk_legl_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('x', -28),
        IDENTITY_QUAT,
        _quat('x',  28),
        IDENTITY_QUAT,
    ])
    walk_legr_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('x',  28),
        IDENTITY_QUAT,
        _quat('x', -28),
        IDENTITY_QUAT,
    ])
    walk_arml_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('x',  22),
        IDENTITY_QUAT,
        _quat('x', -22),
        IDENTITY_QUAT,
    ])
    walk_armr_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('x', -22),
        IDENTITY_QUAT,
        _quat('x',  22),
        IDENTITY_QUAT,
    ])
    ws_ll = _sampler(walk_times, walk_legl_r)
    ws_lr = _sampler(walk_times, walk_legr_r)
    ws_al = _sampler(walk_times, walk_arml_r)
    ws_ar = _sampler(walk_times, walk_armr_r)
    anim_walk = Animation(
        name="Walk",
        samplers=[ws_ll, ws_lr, ws_al, ws_ar],
        channels=[
            _channel(0, N_LEGL, "rotation"),
            _channel(1, N_LEGR, "rotation"),
            _channel(2, N_ARML, "rotation"),
            _channel(3, N_ARMR, "rotation"),
        ],
    )

    # -----------------------------------------------------------------------
    # Clip: Attack (0.8 s) — right arm swings forward hard
    # -----------------------------------------------------------------------
    att_times = _anim_timestamps([0.0, 0.2, 0.5, 0.8])
    att_armr_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('x', -80),
        _quat('x', 25),
        IDENTITY_QUAT,
    ])
    att_samp = _sampler(att_times, att_armr_r)
    anim_attack = Animation(
        name="Attack",
        samplers=[att_samp],
        channels=[_channel(0, N_ARMR, "rotation")],
    )

    # -----------------------------------------------------------------------
    # Clip: Death (1.5 s) — root falls sideways to the ground
    # -----------------------------------------------------------------------
    die_times = _anim_timestamps([0.0, 0.4, 1.0, 1.5])
    die_root_t = _anim_translations([
        [0, 0, 0],
        [0, 0.05*s, 0],   # slight up first (impact stagger)
        [0.2*s, -0.25*s, 0],
        [0.4*s, -0.45*s, 0],
    ])
    die_root_r = _anim_rotations([
        IDENTITY_QUAT,
        _quat('z', 5),
        _quat('z', 55),
        _quat('z', 88),
    ])
    ds_t = _sampler(die_times, die_root_t)
    ds_r = _sampler(die_times, die_root_r)
    anim_death = Animation(
        name="Death",
        samplers=[ds_t, ds_r],
        channels=[
            _channel(0, N_ROOT, "translation"),
            _channel(1, N_ROOT, "rotation"),
        ],
    )

    # -----------------------------------------------------------------------
    # Nodes
    # -----------------------------------------------------------------------
    # Node 0: mesh (references mesh + skin)
    # Node 1: Root (joint 0) → children: Torso(2), LegL(6), LegR(7)
    # Node 2: Torso (joint 1) → children: Head(3), ArmL(4), ArmR(5)
    # Node 3–7: leaf joints
    nodes = [
        Node(mesh=0, skin=0, name=f"{creature_name}_mesh"),
        Node(name=f"{creature_name}_Root",
             translation=[0, 0, 0],
             children=[N_TORSO, N_LEGL, N_LEGR]),
        Node(name=f"{creature_name}_Torso",
             translation=[0, float(J['Torso'][1]), 0],
             children=[N_HEAD, N_ARML, N_ARMR]),
        Node(name=f"{creature_name}_Head",
             translation=[0, float(J['Head'][1] - J['Torso'][1]), 0]),
        Node(name=f"{creature_name}_ArmL",
             translation=[float(J['ArmL'][0]), float(J['ArmL'][1] - J['Torso'][1]), 0]),
        Node(name=f"{creature_name}_ArmR",
             translation=[float(J['ArmR'][0]), float(J['ArmR'][1] - J['Torso'][1]), 0]),
        Node(name=f"{creature_name}_LegL",
             translation=[float(J['LegL'][0]), float(J['LegL'][1]), 0]),
        Node(name=f"{creature_name}_LegR",
             translation=[float(J['LegR'][0]), float(J['LegR'][1]), 0]),
    ]

    # -----------------------------------------------------------------------
    # Assemble GLTF
    # -----------------------------------------------------------------------
    binary = blob.build()
    gltf = GLTF2()
    gltf.asset = Asset(version="2.0",
                        generator=f"NJ-MMO {creature_name} procedural generator v1")
    gltf.buffers = [Buffer(byteLength=len(binary))]
    gltf.bufferViews = bufferViews
    gltf.accessors = accessors
    gltf.materials = [
        Material(
            pbrMetallicRoughness=PbrMetallicRoughness(
                baseColorFactor=[r, g, b, a],
                metallicFactor=0.0,
                roughnessFactor=0.8,
            ),
            name=f"{creature_name}_mat",
        )
    ]
    gltf.meshes = [Mesh(
        name=creature_name,
        primitives=[Primitive(
            attributes={
                "POSITION":  pos_acc,
                "NORMAL":    nrm_acc,
                "JOINTS_0":  jnt_acc,
                "WEIGHTS_0": wgt_acc,
            },
            indices=idx_acc,
            material=0,
        )],
    )]
    gltf.nodes = nodes
    gltf.skins = [Skin(
        name=f"{creature_name}_Armature",
        joints=[N_ROOT, N_TORSO, N_HEAD, N_ARML, N_ARMR, N_LEGL, N_LEGR],
        skeleton=N_ROOT,
        inverseBindMatrices=ibm_acc,
    )]
    gltf.animations = [anim_idle, anim_walk, anim_attack, anim_death]
    gltf.scenes = [Scene(nodes=[0, 1])]  # mesh node + skeleton root
    gltf.scene = 0
    gltf.set_binary_blob(binary)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    gltf.save_binary(str(output_path))
    size = output_path.stat().st_size
    print(f"  [MOB]   {output_path.name}  ({size // 1024} KB, skins=1, anims=4)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def generate_environment_props():
    print("\n=== Environment Props ===")

    # Color palette (low-poly flat, warm medieval)
    STONE  = (0.72, 0.60, 0.42, 1.0)   # warm sandstone walls
    DARK_S = (0.52, 0.44, 0.30, 1.0)   # darker stone (tower, barn)
    TERRA  = (0.60, 0.25, 0.18, 1.0)   # terracotta roof
    DARK_R = (0.40, 0.18, 0.13, 1.0)   # dark roof (barn)
    TRUNK  = (0.40, 0.26, 0.10, 1.0)   # bark brown
    LEAF   = (0.22, 0.55, 0.15, 1.0)   # foliage green
    ROCK_C = (0.50, 0.47, 0.42, 1.0)   # grey rock
    GOLD   = (0.85, 0.78, 0.28, 1.0)   # peace marker gold
    GOLD_B = (0.70, 0.64, 0.20, 1.0)   # peace marker base

    # ----- Building_0: small shop / cottage (3 × 2.8 × 3.2) -----
    b0w_pos, b0w_nrm, b0w_idx = _flat_box(3.0, 2.8, 3.2)
    b0r_pos, b0r_nrm, b0r_idx = _flat_wedge(3.4, 1.6, 3.5)
    b0r_pos = _translate(b0r_pos, 0, 2.8, 0)
    _build_static_glb(ENV_DIR / "Building_0.glb", "Building_0", [
        (b0w_pos, b0w_nrm, b0w_idx, STONE),
        (b0r_pos, b0r_nrm, b0r_idx, TERRA),
    ])

    # ----- Building_1: medium house (4.5 × 3.2 × 4) -----
    b1w_pos, b1w_nrm, b1w_idx = _flat_box(4.5, 3.2, 4.0)
    b1r_pos, b1r_nrm, b1r_idx = _flat_wedge(4.9, 2.0, 4.3)
    b1r_pos = _translate(b1r_pos, 0, 3.2, 0)
    _build_static_glb(ENV_DIR / "Building_1.glb", "Building_1", [
        (b1w_pos, b1w_nrm, b1w_idx, STONE),
        (b1r_pos, b1r_nrm, b1r_idx, TERRA),
    ])

    # ----- Building_2: stone tower (2.2 × 7 × 2.2) + parapet ring -----
    b2w_pos, b2w_nrm, b2w_idx = _flat_box(2.2, 7.0, 2.2)
    b2p_pos, b2p_nrm, b2p_idx = _flat_box(2.8, 0.6, 2.8)
    b2p_pos = _translate(b2p_pos, 0, 7.0, 0)
    _build_static_glb(ENV_DIR / "Building_2.glb", "Building_2", [
        (b2w_pos, b2w_nrm, b2w_idx, DARK_S),
        (b2p_pos, b2p_nrm, b2p_idx, DARK_S),
    ])

    # ----- Building_3: wide barn (7 × 3 × 4.5) -----
    b3w_pos, b3w_nrm, b3w_idx = _flat_box(7.0, 3.0, 4.5)
    b3r_pos, b3r_nrm, b3r_idx = _flat_wedge(7.3, 1.4, 4.8)
    b3r_pos = _translate(b3r_pos, 0, 3.0, 0)
    _build_static_glb(ENV_DIR / "Building_3.glb", "Building_3", [
        (b3w_pos, b3w_nrm, b3w_idx, DARK_S),
        (b3r_pos, b3r_nrm, b3r_idx, DARK_R),
    ])

    # ----- Building_4: large inn / hall (5.5 × 4.5 × 5.5) -----
    b4w_pos, b4w_nrm, b4w_idx = _flat_box(5.5, 4.5, 5.5)
    b4r_pos, b4r_nrm, b4r_idx = _flat_wedge(5.9, 2.8, 5.8)
    b4r_pos = _translate(b4r_pos, 0, 4.5, 0)
    _build_static_glb(ENV_DIR / "Building_4.glb", "Building_4", [
        (b4w_pos, b4w_nrm, b4w_idx, STONE),
        (b4r_pos, b4r_nrm, b4r_idx, TERRA),
    ])

    # ----- Tree: trunk cylinder + foliage cone -----
    tr_pos, tr_nrm, tr_idx = _flat_cylinder(0.22, 1.6, segs=8)
    fo_pos, fo_nrm, fo_idx = _flat_cone(1.3, 3.2, segs=8)
    fo_pos = _translate(fo_pos, 0, 1.4, 0)
    # Second foliage tier for fuller look
    fo2_pos, fo2_nrm, fo2_idx = _flat_cone(0.9, 2.2, segs=8)
    fo2_pos = _translate(fo2_pos, 0, 2.6, 0)
    _build_static_glb(ENV_DIR / "Tree.glb", "Tree", [
        (tr_pos, tr_nrm, tr_idx, TRUNK),
        (fo_pos, fo_nrm, fo_idx, LEAF),
        (fo2_pos, fo2_nrm, fo2_idx, (0.18, 0.62, 0.12, 1.0)),
    ])

    # ----- Rock: irregular box cluster (2 overlapping boxes at different angles) -----
    rk0_pos, rk0_nrm, rk0_idx = _flat_box(2.0, 0.7, 1.5)
    rk0_pos = _translate(rk0_pos, 0, 0, 0)
    rk1_pos, rk1_nrm, rk1_idx = _flat_box(1.3, 0.55, 1.0)
    rk1_pos = _translate(rk1_pos, 0.25, 0.65, 0.1)
    rk2_pos, rk2_nrm, rk2_idx = _flat_box(0.9, 0.45, 0.8)
    rk2_pos = _translate(rk2_pos, -0.3, 0.62, -0.15)
    _build_static_glb(ENV_DIR / "Rock.glb", "Rock", [
        (rk0_pos, rk0_nrm, rk0_idx, ROCK_C),
        (rk1_pos, rk1_nrm, rk1_idx, (0.55, 0.52, 0.46, 1.0)),
        (rk2_pos, rk2_nrm, rk2_idx, (0.46, 0.44, 0.40, 1.0)),
    ])

    # ----- PeaceMarker: tall golden pillar with disc base and top cap -----
    pm_shaft, pm_sn, pm_si = _flat_cylinder(0.14, 2.8, segs=8)
    pm_top_p, pm_top_n, pm_top_i = _flat_cylinder(0.30, 0.22, segs=8)
    pm_top_p = _translate(pm_top_p, 0, 2.8, 0)
    pm_base_p, pm_base_n, pm_base_i = _flat_cylinder(0.36, 0.25, segs=8)
    _build_static_glb(ENV_DIR / "PeaceMarker.glb", "PeaceMarker", [
        (pm_shaft, pm_sn, pm_si, GOLD),
        (pm_top_p, pm_top_n, pm_top_i, GOLD_B),
        (pm_base_p, pm_base_n, pm_base_i, GOLD_B),
    ])


def generate_monster_glbs():
    print("\n=== Monster GLBs ===")

    # Gremlin: slender imp-like biped, ~1.0m before manifest scale (0.52 → ~0.6m in game)
    # Slight lime-green tint — small, spry, mischievous
    _build_humanoid_glb(
        MON_DIR / "Gremlin.glb",
        creature_name="Gremlin",
        body_color=(0.35, 0.55, 0.20, 1.0),   # lime-green
        head_color=(0.30, 0.50, 0.16, 1.0),   # darker head
        overall_height=1.0,
    )

    # Goblin: stocky short humanoid, ~1.15m before manifest scale (0.61 → ~0.7m in game)
    # Darker olive/muddy green — stockier dimensions baked into the mesh
    _build_humanoid_glb(
        MON_DIR / "Goblin.glb",
        creature_name="Goblin",
        body_color=(0.28, 0.40, 0.12, 1.0),   # dark olive green
        head_color=(0.22, 0.34, 0.08, 1.0),   # very dark green head
        overall_height=1.15,
    )


if __name__ == "__main__":
    print("NJ-MMO GLB Asset Generator")
    print("=" * 40)
    generate_environment_props()
    generate_monster_glbs()
    print("\nAll assets generated successfully.")
    print("Next: node scripts/visual-gate.mjs")
