import { DefectCategory } from './types';

export const DEFAULT_DEFECT_ITEMS: Record<DefectCategory, string[]> = {
  [DefectCategory.CEILING]: [
    '油漆不均',
    '裂縫',
    '滲漏水痕',
    '燈具安裝不平',
    '消防偵測器異常',
    '維修孔收邊粗糙'
  ],
  [DefectCategory.FLOOR]: [
    '地磚空鼓',
    '地磚裂縫',
    '地磚色差',
    '踢腳板鬆脫',
    '排水坡度不足',
    '木地板異音'
  ],
  [DefectCategory.WALL]: [
    '油漆髒污',
    '牆面不平整',
    '插座面板鬆動',
    '窗框滲水',
    '門框刮傷',
    '大門開關不順'
  ],
  [DefectCategory.OTHER]: [
    '水龍頭漏水',
    '櫥櫃五金異常',
    '對講機功能異常',
    '冷氣排水管阻塞'
  ]
};
