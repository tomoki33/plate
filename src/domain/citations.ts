/**
 * アプリが表示する数値（カロリー・PFC・減量／増量のペースなど）の根拠と出典。
 * 「根拠と出典」画面（src/app/sources.tsx）に出す。App Review Guideline 1.4.1（健康情報には出典を）への対応。
 *
 * 書いたこと：
 *  - 出典がある計算は、論文／公的資料を示す（DOI や公式ページへのリンク）
 *  - 本アプリ独自の設計・しきい値は、「独自の設計」とはっきり書く（出典があるように見せない）
 */
export interface Source {
  /** 表示名（著者・年・誌名） */
  title: string;
  /** 一言の説明 */
  note?: string;
  url: string;
}

export interface Basis {
  id: string;
  /** どの数値・機能の話か */
  topic: string;
  /** アプリでの使い方（利用者向けの説明） */
  usage: string;
  /** 出典。空なら「独自の設計」 */
  sources: Source[];
  /** 出典がないもの（独自の設計）かどうかの注記 */
  original?: string;
}

const doi = (d: string) => `https://doi.org/${d}`;

export const BASES: Basis[] = [
  {
    id: 'bmr',
    topic: '基礎代謝・維持カロリー',
    usage: '性別・年齢・身長・体重から基礎代謝（Mifflin-St Jeor 式）を出し、活動量の係数をかけて、1日の維持カロリーの目安にしています。3週目からは、記録した食事と体重の変化で補正します。',
    sources: [
      { title: 'Mifflin MD, et al. Am J Clin Nutr. 1990', note: '基礎代謝の予測式（Mifflin-St Jeor 式）', url: doi('10.1093/ajcn/51.2.241') },
      { title: 'FAO/WHO/UNU. Human energy requirements (2004)', note: '活動量の係数（身体活動レベル）の考え方', url: 'https://www.fao.org/4/y5686e/y5686e00.htm' },
    ],
    original: '活動量を3段階（1.4／1.6／1.85）にまとめている点と、記録による補正の方法は、本アプリ独自の簡略化です。',
  },
  {
    id: 'energy',
    topic: '体重の変化とカロリー（1kg ≒ 7,700kcal）',
    usage: '目標のペース（kg/週）を、1日のカロリーの増減に換算するときに、1kg ≒ 7,700kcal を使っています。実際の体の変化は、この換算ほど直線的ではないため、あくまで目安です。',
    sources: [
      { title: 'Wishnofsky M. Am J Clin Nutr. 1958', note: '1kg あたりのエネルギーの換算の元になった報告', url: doi('10.1093/ajcn/6.5.542') },
      { title: 'Hall KD, et al. Lancet. 2011', note: '体重変化はこの換算より複雑であることを示した報告', url: doi('10.1016/S0140-6736(11)60812-X') },
    ],
  },
  {
    id: 'cut',
    topic: '減量のペース（体重の 0.5〜1%／週）',
    usage: '減量のペースは、体重の 0.5〜1%／週の範囲から選べます。これより速いと筋肉が落ちやすいとされるため、1%を超えると警告を出します。',
    sources: [
      { title: 'Helms ER, et al. J Int Soc Sports Nutr. 2014', note: '減量時の目安（週に体重の 0.5〜1%）', url: doi('10.1186/1550-2783-11-20') },
      { title: 'Garthe I, et al. Int J Sport Nutr Exerc Metab. 2011', note: '減量の速さによる、筋肉量への影響の比較', url: doi('10.1123/ijsnem.21.2.97') },
    ],
  },
  {
    id: 'bulk',
    topic: '増量のペース（体重の 0.25〜0.5%／週）',
    usage: '増量のペースは、体重の 0.25〜0.5%／週の範囲から選べます。速すぎると、筋肉より脂肪が増えやすいとされています。',
    sources: [{ title: 'Iraki J, et al. Sports (Basel). 2019', note: '増量期の栄養に関する総説', url: doi('10.3390/sports7070154') }],
  },
  {
    id: 'protein',
    topic: 'たんぱく質（体重 1kg あたり 1.6〜3.0g）',
    usage: 'たんぱく質の目安は、体重 1kg あたり 2.0〜2.2g を初期値にして、1.6〜3.0g の範囲で変えられます。減量中は、筋肉を保つため、やや多めにしています。',
    sources: [
      { title: 'Morton RW, et al. Br J Sports Med. 2018', note: '筋トレでの筋肉の増加は、1日 約1.6g/kg でほぼ頭打ちになるという分析', url: doi('10.1136/bjsports-2017-097608') },
      { title: 'Jäger R, et al. J Int Soc Sports Nutr. 2017', note: '運動する人のたんぱく質の摂取量（国際スポーツ栄養学会の見解）', url: doi('10.1186/s12970-017-0177-8') },
    ],
  },
  {
    id: 'fat',
    topic: '脂質の割合（エネルギーの 20〜25%）',
    usage: '脂質は、トレーニングの日に 20%、オフの日に 25% を目安にしています（下限は体重 × 0.6g）。残りのカロリーが、炭水化物になります。',
    sources: [{ title: '厚生労働省「日本人の食事摂取基準」', note: '脂質の目標量は、成人でエネルギーの 20〜30%', url: 'https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/eiyou/syokuji_kijyun.html' }],
    original: 'トレーニングの日とオフの日で割合を変える設計は、本アプリ独自です。',
  },
  {
    id: 'food',
    topic: '食品の栄養成分',
    usage: '食品のカロリーと PFC は、日本食品標準成分表（八訂）の値を使っています（可食部 100g あたり）。料理など成分表にないものは、標準的な値を使うか、AI の目安として表示します。',
    sources: [{ title: '文部科学省「日本食品標準成分表（八訂）」', note: '食品の栄養成分の公的データ', url: 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html' }],
  },
  {
    id: 'daytype',
    topic: 'トレーニングの日に多く、オフの日に少なく',
    usage: '1週間のカロリーの合計を、トレーニングの内容に応じて、日ごとに配分しています（高い日 +15%、オフの日 −15% が初期値）。過不足が出た日は、残りの日でゆるやかに調整します。',
    sources: [],
    original: 'この配分の方法と数値は、本アプリ独自の設計で、特定の研究にもとづくものではありません。',
  },
  {
    id: 'safety',
    topic: '警告の基準（基礎代謝や 1,200kcal を下回る目標）',
    usage: '1日の平均が、基礎代謝（最低 1,200kcal）を下回る目標や、体重の 1% を超える減量ペースには、警告を出します。',
    sources: [],
    original: '安全側に倒した、本アプリ独自の目安です。',
  },
  {
    id: '1rm',
    topic: '推定 1RM',
    usage: 'トレーニングの記録から、1回だけ挙げられる重さ（1RM）を、Epley 式（重さ × (1 + 回数 ÷ 30)）で推定しています。',
    sources: [],
    original: '一般に広く使われている推定式で、実際の 1RM とは差があります。',
  },
];

export const DISCLAIMER = '表示する数値は、一般的な計算にもとづく目安で、医療的な助言・診断ではありません。持病のある方、妊娠中・授乳中の方、未成年の方、極端な減量をする方は、医師や管理栄養士にご相談ください。体調に異常を感じたときは、すぐに使用をやめてください。';
