export interface MaterialSection {
  icon: string
  title: string
  content: string
  highlight?: string
}

export interface MiniQuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export interface MaterialActivity {
  type: 'choice' | 'plate' | 'label'
  title: string
  instruction: string
  options?: { label: string; detail?: string }[]
  correct?: number
  success: string
}

export interface Material {
  id: number
  icon: string
  heroIcons: string[]
  title: string
  desc: string
  color: string
  bg: string
  duration: string
  keyPoints: string[]
  sections: MaterialSection[]
  everydayExample: string
  funFact: string
  conclusion: string
  miniQuiz: MiniQuizQuestion[]
  activity: MaterialActivity
  tableData?: { label: string; function: string; examples: string }[]
}

export const materials: Material[] = [
  {
    id: 1,
    icon: '🥗',
    heroIcons: ['🍚', '🐟', '🥕', '💧'],
    title: 'Kenalan dengan Zat Gizi',
    desc: 'Kenali zat gizi yang dibutuhkan tubuh untuk tumbuh, belajar, dan beraktivitas.',
    color: '#42A5F5',
    bg: '#BBDEFB',
    duration: '9 menit',
    keyPoints: [
      'Arti zat gizi dan manfaatnya bagi tubuh',
      'Fungsi karbohidrat, protein, dan lemak',
      'Manfaat vitamin, mineral, air, dan serat',
      'Contoh sumber zat gizi di sekitar kita',
    ],
    sections: [
      {
        icon: '💡',
        title: 'Apa Itu Zat Gizi?',
        content: 'Zat gizi adalah bagian dari makanan dan minuman yang dibutuhkan tubuh. Zat gizi membantu kita tumbuh, berpikir, bermain, dan menjaga tubuh tetap sehat.',
        highlight: 'Tubuh membutuhkan beragam zat gizi, bukan hanya satu jenis makanan.',
      },
      {
        icon: '⚡',
        title: 'Karbohidrat, Protein, dan Lemak',
        content: 'Karbohidrat adalah sumber energi utama. Contohnya nasi, roti, kentang, jagung, singkong, dan ubi.\n\nProtein membantu tubuh tumbuh dan memperbaiki sel yang rusak. Contohnya ikan, telur, ayam, daging, tempe, dan tahu.\n\nLemak menjadi cadangan energi dan membantu tubuh menyerap vitamin A, D, E, dan K. Pilih kacang, biji-bijian, ikan, dan minyak nabati. Lemak tetap dibutuhkan, tetapi jangan berlebihan.',
      },
      {
        icon: '🌈',
        title: 'Vitamin',
        content: 'Vitamin A membantu menjaga mata. Vitamin B membantu tubuh menggunakan energi dan menjaga saraf. Vitamin C membantu daya tahan tubuh. Vitamin D membantu tubuh menggunakan kalsium. Vitamin K membantu darah membeku saat terluka.',
      },
      {
        icon: '🦴',
        title: 'Mineral',
        content: 'Zat besi membantu pembentukan darah. Kalsium membantu menguatkan tulang dan gigi. Yodium membantu kelenjar tiroid bekerja dengan baik. Kalium membantu kerja otot dan saraf.\n\nSumbernya antara lain ikan, telur, susu, tahu, sayuran hijau, pisang, dan garam beryodium.',
      },
      {
        icon: '💧',
        title: 'Air dan Serat',
        content: 'Air mengganti cairan yang hilang saat berkeringat. Kurang minum dapat menyebabkan dehidrasi, misalnya haus, lemas, atau pusing.\n\nSerat banyak terdapat pada sayur dan buah. Serat membantu pencernaan dan mencegah sembelit.',
      },
    ],
    everydayExample: 'Saat sarapan nasi, telur, sayur bayam, pepaya, dan air putih, kamu mendapatkan beberapa zat gizi sekaligus untuk belajar di kelas.',
    funFact: 'Setiap zat gizi punya tugas berbeda. Karena itu, makanan yang beragam membantu tubuh bekerja sebagai satu tim.',
    conclusion: 'Tubuh membutuhkan karbohidrat, protein, lemak, vitamin, mineral, air, dan serat dalam jumlah yang sesuai.',
    miniQuiz: [
      { question: 'Zat gizi yang menjadi sumber energi utama adalah...', options: ['Karbohidrat', 'Vitamin K', 'Air'], correct: 0, explanation: 'Karbohidrat memberi energi untuk belajar, bermain, dan berolahraga.' },
      { question: 'Zat yang membantu melancarkan pencernaan adalah...', options: ['Garam', 'Serat', 'Lemak'], correct: 1, explanation: 'Serat dari sayur dan buah membantu mencegah sembelit.' },
    ],
    activity: {
      type: 'choice',
      title: 'Cari Tim Zat Gizi',
      instruction: 'Pilih bekal yang paling beragam zat gizinya.',
      options: [{ label: 'Nasi + telur + sayur + pepaya + air' }, { label: 'Permen + minuman manis' }, { label: 'Keripik saja' }],
      correct: 0,
      success: 'Hebat! Bekal itu memiliki sumber energi, protein, vitamin, mineral, serat, dan air.',
    },
  },
  {
    id: 2,
    icon: '🍚',
    heroIcons: ['🍚', '🍳', '🥜'],
    title: 'Karbohidrat, Protein, dan Lemak',
    desc: 'Pelajari sumber energi, zat pembangun tubuh, dan fungsi lemak.',
    color: '#FF7043',
    bg: '#FFE0B2',
    duration: '8 menit',
    keyPoints: [
      'Karbohidrat sebagai sumber energi utama',
      'Protein hewani dan nabati untuk pertumbuhan',
      'Lemak sebagai cadangan energi',
      'Cara memilih sumber lemak dengan bijak',
    ],
    sections: [
      {
        icon: '🍚',
        title: 'Karbohidrat: Sumber Energi',
        content: 'Tubuh membutuhkan energi saat belajar, berlari, bermain sepak bola, dan berolahraga. Sumber energi utama berasal dari karbohidrat.\n\nContohnya nasi, roti, jagung, kentang, singkong, dan ubi. Contoh menu: nasi + ikan + sayur, atau roti + telur + buah.',
        highlight: 'Karbohidrat membantu tubuh bertenaga untuk beraktivitas.',
      },
      {
        icon: '🐟',
        title: 'Protein: Zat Pembangun',
        content: 'Protein membantu pertumbuhan otot dan memperbaiki jaringan tubuh yang rusak.\n\nProtein hewani: telur, ikan, ayam, daging, dan susu.\nProtein nabati: tempe, tahu, dan kacang-kacangan.',
      },
      {
        icon: '🥜',
        title: 'Lemak: Tetap Dibutuhkan',
        content: 'Lemak menjadi cadangan energi dan membantu penyerapan vitamin A, D, E, dan K. Sumber lemak antara lain kacang-kacangan, biji-bijian, ikan, dan minyak nabati.\n\nPilih dengan bijak dan jangan berlebihan. Terlalu sering makan makanan berlemak tinggi tanpa aktif bergerak dapat membuat energi menumpuk.',
      },
    ],
    everydayExample: 'Sebelum latihan olahraga, kamu bisa makan nasi atau ubi untuk energi. Setelahnya, telur atau tempe membantu pertumbuhan dan perbaikan tubuh.',
    funFact: 'Tempe adalah makanan Indonesia yang mudah ditemukan dan merupakan sumber protein nabati.',
    conclusion: 'Karbohidrat memberi energi, protein membangun tubuh, dan lemak menjadi cadangan energi serta membantu penyerapan vitamin.',
    miniQuiz: [
      { question: 'Tempe dan tahu termasuk sumber...', options: ['Protein nabati', 'Karbohidrat', 'Air'], correct: 0, explanation: 'Tempe dan tahu dibuat dari kedelai dan kaya protein nabati.' },
      { question: 'Lemak membantu penyerapan vitamin...', options: ['A, D, E, K', 'B dan C saja', 'Semua mineral'], correct: 0, explanation: 'Vitamin A, D, E, dan K membutuhkan lemak agar dapat diserap dengan baik.' },
    ],
    activity: {
      type: 'choice',
      title: 'Pasangkan dengan Kegiatan',
      instruction: 'Kamu akan bermain sepak bola. Pilih makanan sumber energi utama.',
      options: [{ label: 'Nasi dan jagung' }, { label: 'Air putih saja' }, { label: 'Wortel saja' }],
      correct: 0,
      success: 'Tepat! Nasi dan jagung mengandung karbohidrat sebagai sumber energi.',
    },
    tableData: [
      { label: 'Karbohidrat', function: 'Sumber energi', examples: 'Nasi, roti, jagung' },
      { label: 'Protein', function: 'Pertumbuhan dan perbaikan tubuh', examples: 'Telur, ikan, tempe' },
      { label: 'Lemak', function: 'Cadangan energi dan membantu penyerapan vitamin', examples: 'Kacang, ikan, minyak nabati' },
    ],
  },
  {
    id: 3,
    icon: '🍊',
    heroIcons: ['🥕', '🍊', '🥛', '🧂'],
    title: 'Vitamin dan Mineral',
    desc: 'Kenali vitamin dan mineral yang membantu tubuh tetap sehat.',
    color: '#AB47BC',
    bg: '#E1BEE7',
    duration: '10 menit',
    keyPoints: [
      'Fungsi vitamin A, B, C, D, dan K',
      'Kalsium untuk tulang dan gigi',
      'Zat besi untuk membantu pembentukan darah',
      'Yodium untuk menjaga kesehatan kelenjar tiroid',
    ],
    sections: [
      {
        icon: '🥕',
        title: 'Vitamin A, B, dan C',
        content: 'Vitamin A membantu menjaga kesehatan mata. Sumbernya wortel, sayuran hijau atau oranye, dan telur.\n\nVitamin B membantu tubuh menggunakan energi dan mendukung fungsi saraf. Sumbernya kacang-kacangan, telur, daging, dan biji-bijian.\n\nVitamin C membantu menjaga daya tahan tubuh. Sumbernya jeruk, jambu, dan pepaya.',
      },
      {
        icon: '☀️',
        title: 'Vitamin D dan K',
        content: 'Vitamin D membantu tubuh menggunakan kalsium untuk tulang dan gigi. Tubuh dapat membentuk vitamin D dengan bantuan sinar matahari. Vitamin D juga terdapat pada telur dan ikan.\n\nVitamin K membantu proses pembekuan darah saat kita terluka. Sumbernya antara lain sayuran hijau.',
        highlight: 'Vitamin dibutuhkan sedikit, tetapi tugasnya sangat penting.',
      },
      {
        icon: '🦴',
        title: 'Kalsium dan Zat Besi',
        content: 'Kalsium membantu memperkuat tulang dan gigi. Sumbernya susu, ikan teri, tahu, dan sayuran hijau.\n\nZat besi membantu pembentukan darah. Kekurangan zat besi dapat menyebabkan anemia sehingga seseorang dapat merasa lemas dan pucat. Sumbernya daging, hati, ikan, telur, tempe, dan sayuran hijau.',
      },
      {
        icon: '🧂',
        title: 'Yodium dan Kalium',
        content: 'Yodium membantu kelenjar tiroid bekerja dengan baik. Kekurangan yodium dapat menyebabkan pembesaran kelenjar tiroid atau gondok. Salah satu sumbernya adalah garam beryodium.\n\nKalium membantu kerja otot dan saraf. Kalium terdapat pada pisang, kentang, dan sayuran.',
      },
    ],
    everydayExample: 'Bekal nasi, ikan, tumis wortel, dan jeruk memberi tubuh beberapa vitamin dan mineral yang berbeda.',
    funFact: 'Jambu biji adalah buah yang mudah ditemukan di Indonesia dan mengandung vitamin C.',
    conclusion: 'Vitamin dan mineral membantu mata, saraf, daya tahan tubuh, darah, tulang, gigi, otot, dan kelenjar tiroid.',
    miniQuiz: [
      { question: 'Mineral yang membantu pembentukan darah adalah...', options: ['Kalsium', 'Zat besi', 'Yodium'], correct: 1, explanation: 'Kekurangan zat besi dapat menyebabkan anemia, lemas, dan pucat.' },
      { question: 'Vitamin yang membantu pembekuan darah adalah...', options: ['Vitamin K', 'Vitamin C', 'Vitamin A'], correct: 0, explanation: 'Vitamin K membantu darah membeku saat tubuh terluka.' },
    ],
    activity: {
      type: 'choice',
      title: 'Pilih untuk Mata',
      instruction: 'Pilih makanan yang dikenal sebagai sumber vitamin A.',
      options: [{ label: 'Wortel' }, { label: 'Permen' }, { label: 'Minuman bersoda' }],
      correct: 0,
      success: 'Benar! Wortel mengandung beta-karoten yang dapat diubah tubuh menjadi vitamin A.',
    },
  },
  {
    id: 4,
    icon: '🍱',
    heroIcons: ['🍚', '🐟', '🥬', '🍌'],
    title: 'Gizi Seimbang Setiap Hari',
    desc: 'Belajar memilih berbagai makanan agar kebutuhan gizi tubuh terpenuhi.',
    color: '#66BB6A',
    bg: '#C8E6C9',
    duration: '8 menit',
    keyPoints: [
      'Arti gizi seimbang',
      'Pentingnya makan makanan yang beragam',
      'Makanan pokok, lauk, sayur, buah, dan air',
      'Contoh menu sederhana sepanjang hari',
    ],
    sections: [
      {
        icon: '⚖️',
        title: 'Apa Itu Gizi Seimbang?',
        content: 'Gizi seimbang berarti makan beragam makanan dalam jumlah yang sesuai kebutuhan tubuh. Kita tidak boleh hanya makan satu jenis makanan karena tidak ada satu makanan yang berisi semua zat gizi.',
        highlight: 'Beragam makanan membantu tubuh mendapat beragam zat gizi.',
      },
      {
        icon: '🍽️',
        title: 'Isi Menu Sehari-hari',
        content: 'Usahakan ada makanan pokok, lauk-pauk, sayur, buah, dan air putih.\n\nMakanan pokok memberi energi. Lauk memberi protein. Sayur dan buah memberi vitamin, mineral, dan serat. Air membantu menjaga cairan tubuh.',
      },
      {
        icon: '🌅',
        title: 'Contoh Menu Sehari',
        content: 'Sarapan: nasi atau roti + telur + sayur + buah + air putih.\n\nMakan siang: nasi + ikan, ayam, atau tempe + sayur + buah + air putih.\n\nMakan malam: nasi + tahu, ikan, atau telur + sayur + buah.',
      },
      {
        icon: '🏠',
        title: 'Sehat Tidak Harus Mahal',
        content: 'Makanan sehat dapat berasal dari bahan yang mudah ditemukan di rumah, seperti nasi, tempe, tahu, telur, ikan, bayam, kangkung, pisang, dan pepaya.',
      },
    ],
    everydayExample: 'Daripada hanya membawa mi, lengkapi bekal dengan telur atau tempe, sayur, buah, dan air putih.',
    funFact: 'Warna makanan yang beragam sering menunjukkan kandungan zat gizi yang beragam juga.',
    conclusion: 'Makan beragam makanan dalam porsi yang sesuai membantu pertumbuhan, daya tahan tubuh, dan kegiatan belajar.',
    miniQuiz: [
      { question: 'Mengapa kita perlu makan beragam makanan?', options: ['Agar mendapat beragam zat gizi', 'Agar piring terlihat penuh', 'Agar selalu mahal'], correct: 0, explanation: 'Setiap jenis makanan membawa zat gizi yang berbeda.' },
      { question: 'Menu yang lebih seimbang adalah...', options: ['Nasi + ikan + bayam + pisang', 'Mi saja', 'Permen + sirop'], correct: 0, explanation: 'Menu itu berisi makanan pokok, lauk, sayur, dan buah.' },
    ],
    activity: {
      type: 'choice',
      title: 'Perbaiki Bekalmu',
      instruction: 'Bekalmu baru berisi nasi. Pilih tambahan yang paling lengkap.',
      options: [{ label: 'Ikan + sayur + buah' }, { label: 'Kerupuk saja' }, { label: 'Nasi lagi' }],
      correct: 0,
      success: 'Bagus! Lauk, sayur, dan buah membuat bekal lebih beragam.',
    },
  },
  {
    id: 5,
    icon: '🍽️',
    heroIcons: ['🍚', '🐟', '🥦', '🍉'],
    title: 'Isi Piringku',
    desc: 'Susun piring makan dengan makanan pokok, lauk, sayur, dan buah.',
    color: '#FFC107',
    bg: '#FFF9C4',
    duration: '9 menit',
    keyPoints: [
      'Setengah piring berisi sayur dan buah',
      'Setengah lainnya berisi makanan pokok dan lauk',
      'Contoh pilihan makanan dari Indonesia',
      'Cara menyusun satu menu yang lebih seimbang',
    ],
    sections: [
      {
        icon: '🍽️',
        title: 'Piring Dibagi Dua',
        content: 'Dalam panduan Isi Piringku, 1/2 bagian piring diisi sayur dan buah. Setengah bagian lainnya diisi makanan pokok dan lauk-pauk.',
        highlight: 'Ingat: ada makanan pokok, lauk, sayur, dan buah.',
      },
      {
        icon: '🥦',
        title: 'Setengah Piring: Sayur dan Buah',
        content: 'Pilih sayur seperti bayam, wortel, brokoli, kangkung, atau sayur sop.\n\nPilih buah seperti pisang, pepaya, jeruk, apel, atau semangka.',
      },
      {
        icon: '🍚',
        title: 'Setengah Lainnya: Pokok dan Lauk',
        content: 'Makanan pokok: nasi, jagung, kentang, ubi, atau singkong.\n\nLauk: ikan, telur, ayam, tahu, atau tempe. Lauk membantu menyediakan protein bagi tubuh.',
      },
      {
        icon: '✅',
        title: 'Contoh Satu Menu',
        content: 'Nasi + ikan + sayur bayam + pepaya + air putih adalah contoh menu yang lebih seimbang dan mudah ditemukan di rumah.',
      },
    ],
    everydayExample: 'Saat makan bersama keluarga, lihat piringmu. Pastikan tidak hanya ada nasi dan lauk, tetapi juga sayur dan buah.',
    funFact: 'Isi Piringku membantu kita mengingat susunan makanan dalam satu kali makan dengan melihat pembagian piring.',
    conclusion: 'Isi Piringku terdiri dari makanan pokok, lauk, sayur, dan buah dalam bagian yang seimbang.',
    miniQuiz: [
      { question: 'Setengah bagian piring berisi...', options: ['Sayur dan buah', 'Nasi saja', 'Lauk saja'], correct: 0, explanation: 'Separuh piring diisi sayur dan buah.' },
      { question: 'Yang termasuk lauk adalah...', options: ['Ikan dan tempe', 'Nasi dan ubi', 'Pepaya dan jeruk'], correct: 0, explanation: 'Ikan dan tempe adalah lauk sumber protein.' },
    ],
    activity: {
      type: 'plate',
      title: 'Yuk Susun Isi Piringku!',
      instruction: 'Pilih satu makanan pokok, lauk, sayur, dan buah. Setelah lengkap, periksa piringmu.',
      success: 'Piringmu sudah lengkap! Ada makanan pokok, lauk, sayur, dan buah.',
    },
    tableData: [
      { label: '1/2 piring', function: 'Sayur dan buah', examples: 'Bayam, wortel, pepaya, pisang' },
      { label: '1/2 lainnya', function: 'Makanan pokok dan lauk', examples: 'Nasi, ubi, ikan, tahu' },
    ],
  },
  {
    id: 6,
    icon: '💧',
    heroIcons: ['💧', '🍌', '🥕', '⚽'],
    title: 'Air, Serat, dan Pencernaan Sehat',
    desc: 'Kenali pentingnya air putih, sayur, buah, dan serat bagi tubuh.',
    color: '#26C6DA',
    bg: '#E0F7FA',
    duration: '7 menit',
    keyPoints: [
      'Air mengganti cairan tubuh yang hilang',
      'Tanda sederhana dehidrasi',
      'Serat membantu pencernaan',
      'Sayur dan buah membantu mencegah sembelit',
    ],
    sections: [
      {
        icon: '💧',
        title: 'Air untuk Tubuh',
        content: 'Tubuh membutuhkan air setiap hari. Air membantu mengganti cairan yang hilang, mengatur suhu tubuh, dan membantu tubuh bekerja dengan baik.\n\nKita kehilangan lebih banyak cairan saat berkeringat. Setelah bermain sepak bola atau olahraga, jangan lupa minum air putih.',
        highlight: 'Air putih adalah pilihan utama untuk memenuhi kebutuhan cairan.',
      },
      {
        icon: '⚠️',
        title: 'Kenali Dehidrasi',
        content: 'Dehidrasi berarti tubuh kekurangan cairan. Tanda sederhananya antara lain haus, mulut kering, lemas, pusing, dan urine berwarna lebih pekat.',
      },
      {
        icon: '🥦',
        title: 'Serat untuk Pencernaan',
        content: 'Serat banyak terdapat pada sayur dan buah. Serat membantu pencernaan dan membantu mencegah sembelit atau sulit buang air besar.\n\nContohnya pepaya, pisang, jeruk, sayuran hijau, dan wortel.',
      },
    ],
    everydayExample: 'Bawa botol air ke sekolah dan pilih buah pepaya atau pisang sebagai camilan agar cairan serta serat tubuh tetap terjaga.',
    funFact: 'Buah dan sayur juga mengandung air, tetapi air putih tetap menjadi minuman utama.',
    conclusion: 'Cukup air putih serta makan sayur dan buah membantu tubuh tetap segar dan pencernaan lebih lancar.',
    miniQuiz: [
      { question: 'Setelah banyak berkeringat, sebaiknya...', options: ['Minum air putih', 'Tidak minum', 'Makan permen'], correct: 0, explanation: 'Air putih mengganti cairan yang hilang melalui keringat.' },
      { question: 'Serat membantu mencegah...', options: ['Sembelit', 'Luka lecet', 'Rabun jauh'], correct: 0, explanation: 'Serat membantu melancarkan buang air besar.' },
    ],
    activity: {
      type: 'choice',
      title: 'Apa yang Harus Dilakukan?',
      instruction: 'Bajumu basah karena keringat setelah bermain bola. Pilih tindakan terbaik.',
      options: [{ label: 'Minum air putih yang cukup' }, { label: 'Minum soda saja' }, { label: 'Tidak minum sampai malam' }],
      correct: 0,
      success: 'Tepat! Air putih membantu mengganti cairan yang hilang.',
    },
  },
  {
    id: 7,
    icon: '🏷️',
    heroIcons: ['🥤', '🏷️', '🔎'],
    title: 'Pilih Makanan dengan Cerdas',
    desc: 'Belajar memilih makanan sehat dan membaca label kemasan.',
    color: '#5C6BC0',
    bg: '#E8EAF6',
    duration: '8 menit',
    keyPoints: [
      'Makanan yang dapat lebih sering dipilih',
      'Makanan yang perlu dibatasi',
      'Bagian penting pada label kemasan',
      'Membandingkan dua produk dengan sederhana',
    ],
    sections: [
      {
        icon: '🥗',
        title: 'Pilih dengan Seimbang',
        content: 'Lebih sering pilih buah, sayur, air putih, makanan rumahan, dan lauk bergizi.\n\nBatasi makanan yang terlalu manis, asin, berlemak, atau terlalu sering diproses. Makanan tersebut bukan berarti selalu dilarang, tetapi perlu diatur jumlah dan seberapa sering kita memakannya.',
        highlight: 'Tidak perlu takut pada makanan. Belajarlah memilih dan menyeimbangkan.',
      },
      {
        icon: '🏷️',
        title: 'Baca Label Kemasan',
        content: 'Sebelum membeli makanan atau minuman kemasan, perhatikan nama produk, tanggal kedaluwarsa, ukuran sajian, energi, gula, lemak, garam atau natrium, dan komposisi.',
      },
      {
        icon: '🔎',
        title: 'Contoh Label Sederhana',
        content: 'Minuman A — ukuran sajian: 250 ml\nEnergi: 90 kkal\nGula: 6 g\nLemak: 0 g\nNatrium: 40 mg\n\nBandingkan produk dengan ukuran sajian yang sama. Untuk diminum lebih sering, pilih yang gulanya lebih rendah.',
      },
    ],
    everydayExample: 'Saat membeli minuman di minimarket, cek tanggal kedaluwarsa dan bandingkan gula pada label sebelum memilih.',
    funFact: 'Komposisi pada kemasan biasanya ditulis dari bahan yang jumlahnya paling banyak.',
    conclusion: 'Membaca label membantu kita memilih makanan sesuai kebutuhan dan membatasi gula, garam, serta lemak.',
    miniQuiz: [
      { question: 'Informasi yang perlu dilihat pada label adalah...', options: ['Gula, lemak, dan natrium', 'Warna bungkus saja', 'Gambar iklan saja'], correct: 0, explanation: 'Informasi gizi membantu kita membandingkan produk.' },
      { question: 'Sebelum membeli produk, kita perlu memeriksa...', options: ['Tanggal kedaluwarsa', 'Hadiah di dalamnya saja', 'Ukuran gambarnya'], correct: 0, explanation: 'Tanggal kedaluwarsa membantu memastikan produk masih aman dikonsumsi.' },
    ],
    activity: {
      type: 'label',
      title: 'Coba Pilih!',
      instruction: 'Kedua minuman berukuran sama. Pilih yang lebih sesuai untuk diminum lebih sering.',
      options: [
        { label: 'Minuman A', detail: '250 ml · gula 6 g · natrium 40 mg' },
        { label: 'Minuman B', detail: '250 ml · gula 24 g · natrium 40 mg' },
      ],
      correct: 0,
      success: 'Pilihan tepat! Dengan ukuran sama, Minuman A memiliki gula lebih rendah.',
    },
  },
  {
    id: 8,
    icon: '🌅',
    heroIcons: ['🍳', '🧼', '⚽', '⚖️'],
    title: 'Kebiasaan Sehat dan Masalah Gizi',
    desc: 'Kenali kebiasaan sehat, sarapan, kebersihan makanan, dan masalah gizi.',
    color: '#EF5350',
    bg: '#FFEBEE',
    duration: '10 menit',
    keyPoints: [
      'Sarapan untuk energi sebelum belajar',
      'Arti malnutrisi dan berat badan berlebih',
      'Pentingnya aktivitas fisik',
      'Cara menjaga kebersihan makanan',
    ],
    sections: [
      {
        icon: '🌅',
        title: 'Sarapan Sebelum Sekolah',
        content: 'Sarapan menyediakan energi sebelum belajar. Anak yang belum sarapan dapat merasa lemas, lapar, atau mengantuk di kelas.\n\nContohnya nasi + telur + sayur, roti + telur + buah, atau nasi + tempe + sayur.',
        highlight: 'Sarapan sederhana tetap bermanfaat jika beragam.',
      },
      {
        icon: '⚖️',
        title: 'Malnutrisi',
        content: 'Malnutrisi adalah kondisi ketika tubuh mendapatkan zat gizi yang tidak sesuai dengan kebutuhannya, misalnya kekurangan atau kelebihan zat gizi.\n\nContohnya, hanya jajan permen dan minuman manis tanpa makan makanan bergizi dapat membuat tubuh kekurangan zat gizi penting.',
      },
      {
        icon: '🏃',
        title: 'Berat Badan Berlebih',
        content: 'Jika terlalu banyak energi masuk dibandingkan energi yang digunakan tubuh dalam waktu lama, berat badan dapat berlebih atau terjadi obesitas.\n\nRisikonya meningkat jika terlalu sering makan makanan tinggi energi dan kurang bergerak. Solusinya adalah makan seimbang, cukup minum, tidur cukup, dan aktif bermain atau berolahraga.',
      },
      {
        icon: '🧼',
        title: 'Kebersihan Makanan',
        content: 'Cuci tangan sebelum makan. Cuci buah dan sayur. Gunakan air bersih. Simpan makanan dengan baik dan perhatikan kebersihannya.\n\nSayuran dicuci dengan air mengalir untuk membantu membersihkan kotoran dan mikroorganisme yang menempel.',
      },
    ],
    everydayExample: 'Sebelum sarapan, cuci tangan. Jika membawa buah, cuci terlebih dahulu dan simpan dalam wadah bersih.',
    funFact: 'Kebiasaan kecil yang dilakukan setiap hari dapat memberi pengaruh besar pada kesehatan.',
    conclusion: 'Sarapan, makan seimbang, aktif bergerak, dan menjaga kebersihan makanan membantu tubuh tumbuh sehat.',
    miniQuiz: [
      { question: 'Belum sarapan dapat membuat siswa...', options: ['Lemas dan mengantuk', 'Selalu lebih kuat', 'Tidak butuh energi'], correct: 0, explanation: 'Sarapan membantu menyediakan energi sebelum belajar.' },
      { question: 'Sayuran sebaiknya dicuci dengan...', options: ['Air mengalir', 'Kain kering saja', 'Minuman manis'], correct: 0, explanation: 'Air mengalir membantu membersihkan kotoran dan mikroorganisme.' },
    ],
    activity: {
      type: 'choice',
      title: 'Urutkan Kebiasaan Baik',
      instruction: 'Kamu akan makan bekal di sekolah. Apa yang dilakukan lebih dahulu?',
      options: [{ label: 'Cuci tangan dengan air bersih' }, { label: 'Langsung makan' }, { label: 'Menyentuh lantai' }],
      correct: 0,
      success: 'Benar! Cuci tangan sebelum makan membantu menjaga kebersihan.',
    },
  },
]
