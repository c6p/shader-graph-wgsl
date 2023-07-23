import { ShaderGraphCompiler, SGNodeOutput } from '../../../compilers';
import { SGNodeData } from '../../../editors';
import { Sockets } from '../../../sockets';
import {
  ExtendReteNode,
  ValueType,
  Rete,
  ScreenPositionModeValue,
  ScreenPositionModeOptions,
} from '../../../types';
import { capitalizeFirstLetter } from '../../../utils';
import { NodeView, SelectControl } from '../../../view';
import { RC } from '../../ReteComponent';
import { TransformationMatrixRC } from '../matrix';
import { ScreenRC } from '../scene';
import { PositionRC } from './PositionRC';

export type ReteScreenPositionNode = ExtendReteNode<
  'ScreenPosition',
  {
    outValue: number[];
    outValueType: ValueType.vec4;
    modeValue: ScreenPositionModeValue;
  }
>;

export class ScreenPositionRC extends RC {
  static Name = 'ScreenPosition';
  constructor() {
    super(ScreenPositionRC.Name);
    this.data.component = NodeView;
  }

  initNode(node: ReteScreenPositionNode) {
    const { data, meta } = node;
    node.initValueType('out', [0, 0, 0, 0], ValueType.vec4);
    node.initValueType('mode', ScreenPositionModeOptions[0], ValueType.string);
    data.exposed ??= true;
    data.expanded ??= true;
    data.preview ??= true;
    data.previewType ??= '3d';
    meta.category = 'input/geometry';
    meta.previewDisabled = false;
    meta.label = 'Screen Position';
  }

  async builder(node: ReteScreenPositionNode) {
    this.initNode(node);
    const out = new Rete.Output('out', 'Out', Sockets.vec4);
    node
      .addOutput(out)
      .addControl(new SelectControl('mode', node, 'Mode', ScreenPositionModeOptions as any, false));
  }

  static initScreenPositionContext(
    compiler: ShaderGraphCompiler,
    mode: Exclude<ScreenPositionModeValue, 'tiled'>,
  ) {
    const node = { name: ScreenPositionRC.Name, data: {} } as any;
    const vertVar = 'ScreenPosition' + capitalizeFirstLetter(mode);

    let code = '';
    if (mode === 'default') {
      const screenPositionVar = ScreenPositionRC.initScreenPositionContext(compiler, 'raw');
      code = `let ${vertVar} = vec4f(${screenPositionVar}.xy / ${screenPositionVar}.w, 0., 0.);`;
    } else if (mode === 'raw') {
      const positionWSVar = PositionRC.initPositionContext(compiler, 'world');
      const ViewProjVar = TransformationMatrixRC.initMatrixContext(compiler, 'ViewProj');
      // sar 没有flipped projection matrix, 所以就没有projectionSign参数
      const codeFn = (varName: string) => /* wgsl */ `
 fn ${varName}(positionCS: vec4f) -> vec4f {
  let o = positionCS * 0.5;
  return vec4f(o.xy + o.w, positionCS.zw);
}`;
      const fnVar = compiler.setContext('defines', node, 'computeScreenPos', codeFn);
      code = `let ${vertVar} = ${fnVar}(${ViewProjVar} * vec4f(${positionWSVar}, 1.0));`;
    } else if (mode === 'center') {
      const screenPositionVar = ScreenPositionRC.initScreenPositionContext(compiler, 'raw');
      code = `let ${vertVar} = vec4f((${screenPositionVar}.xy / ${screenPositionVar}.w) * 2.0 - 1.0, 0., 0.);`;
    }

    compiler.setContext('vertShared', node, mode, { varName: vertVar, code });
    const varyingVar = compiler.setContext(
      'varyings',
      node,
      'v' + mode,
      varName => `${varName}: vec4f`,
    );
    const defVar = compiler.setVarNameMap(node, mode, vertVar, varyingVar);
    compiler.setAutoVaryings(node, mode, varyingVar, vertVar);
    return defVar;
  }

  compileSG(compiler: ShaderGraphCompiler, node: SGNodeData<ReteScreenPositionNode>): SGNodeOutput {
    if (node.data.modeValue !== 'tiled') {
      return {
        outputs: { out: ScreenPositionRC.initScreenPositionContext(compiler, node.data.modeValue) },
        code: '',
      };
    } else {
      const outVar = compiler.getOutVarName(node, 'mode', 'screenPos' + node.data.modeValue);
      const screenPositionVar = ScreenPositionRC.initScreenPositionContext(compiler, 'raw');
      const screenWidth = ScreenRC.initScreenContext(compiler, 'width');
      const screenHeight = ScreenRC.initScreenContext(compiler, 'height');
      return {
        outputs: { out: outVar },
        code: `let ${outVar} = fract(vec4f(((${screenPositionVar}.x / ${screenPositionVar}.w) * 2. - 1.) * ${screenWidth} / ${screenHeight}, (${screenPositionVar}.y / ${screenPositionVar}.w) * 2.0 - 1.0, 0.0, 0.0));`,
      };
    }
  }
}
