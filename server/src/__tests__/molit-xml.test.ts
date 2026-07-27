import { describe, expect, it } from 'vitest';
import { XMLParser } from 'fast-xml-parser';

const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
  <body>
    <items>
      <item>
        <aptNm>테스트아파트</aptNm>
        <umdNm>중구 회현동</umdNm>
        <excluUseAr>84.93</excluUseAr>
        <dealAmount>98,000</dealAmount>
        <floor>12</floor>
        <dealYear>2026</dealYear>
        <dealMonth>5</dealMonth>
        <dealDay>15</dealDay>
        <buildYear>2015</buildYear>
        <sggCd>11140</sggCd>
      </item>
    </items>
  </body>
</response>`;

describe('MOLIT XML shape', () => {
  it('parses apartment trade item fields', () => {
    const parser = new XMLParser({
      ignoreAttributes: false,
      trimValues: true,
      isArray: (name) => name === 'item',
    });
    const parsed = parser.parse(sampleXml) as {
      response: { body: { items: { item: Array<Record<string, string | number>> } } };
    };
    const item = parsed.response.body.items.item[0];
    expect(item.aptNm).toBe('테스트아파트');
    expect(String(item.dealAmount).replace(/,/g, '')).toBe('98000');
    expect(Number(item.excluUseAr)).toBeCloseTo(84.93);
  });
});
