export interface Question {
  id: number
  topic: string
  level: "mudah" | "sedang" | "sulit"
  q: string
  options: string[]
  correct: number
  explanation: string
  img: string
}

const rawQuestions = [
  ["Karbohidrat & Energi", "Budi butuh tenaga ekstra untuk lari pagi. Ibunya membekali roti gandum karena roti tersebut merupakan sumber...", ["Protein pembangun tubuh", "Karbohidrat penghasil energi utama", "Lemak cadangan", "Pelarut vitamin"], 1, "Roti gandum kaya karbohidrat kompleks yang menjadi sumber energi utama tubuh.", "🍞"],
  ["Karbohidrat & Energi", "Ani butuh tenaga untuk aktivitas sepulang sekolah di SDN 038 Kiaracondong. Makanan kaya karbohidrat mana yang paling tepat untuknya?", ["Telur rebus dan ayam", "Nasi dan singkong rebus", "Kacang almond dan keju", "Jeruk dan mangga"], 1, "Nasi dan singkong merupakan sumber karbohidrat yang membantu menyediakan energi.", "🍚"],
  ["Protein & Pertumbuhan", "Anton baru sembuh dari demam berdarah. Untuk memperbaiki sel-sel tubuhnya yang rusak, ia membutuhkan banyak...", ["Karbohidrat", "Protein", "Lemak", "Air"], 1, "Protein berfungsi membangun dan memperbaiki jaringan tubuh.", "🐟"],
  ["Protein & Pertumbuhan", "Keluarga Siti adalah vegetarian yang tidak makan daging. Menu apa yang kaya protein nabati untuk mereka?", ["Daging sapi dan ikan", "Telur dan susu", "Tempe dan tahu", "Ayam dan udang"], 2, "Tempe dan tahu adalah sumber protein nabati yang baik.", "🫘"],
  ["Protein & Pertumbuhan", "Fitra (11 tahun) rajin berenang agar ototnya tumbuh besar. Zat gizi utama pembangun otot yang ia butuhkan adalah...", ["Karbohidrat", "Protein", "Vitamin C", "Air"], 1, "Protein membantu pembentukan dan pemeliharaan otot.", "🏊"],
  ["Lemak Sehat", "Paman Rio makan kuah kaldu sapi di malam yang dingin sebagai cadangan energi dan pelarut vitamin A, D, E, K. Zat gizi ini adalah...", ["Karbohidrat", "Protein", "Lemak", "Mineral"], 2, "Lemak menjadi cadangan energi dan membantu penyerapan vitamin A, D, E, dan K.", "🥣"],
  ["Lemak Sehat", "Ibu ingin membuat camilan sehat dengan lemak yang baik (nabati). Bahan dasar yang sebaiknya dipilih ibu adalah...", ["Nasi putih", "Minyak zaitun dan kacang tanah", "Sayur bayam", "Jeruk manis"], 1, "Minyak zaitun dan kacang tanah mengandung lemak nabati.", "🥜"],
  ["Pola Makan Sehat", "Aldi setiap hari makan gorengan dan sangat malas berolahraga. Dampak buruk jangka panjang bagi Aldi adalah...", ["Tubuh lebih kuat", "Mengalami obesitas (kegemukan berlebih)", "Tulang cepat tumbuh", "Kebal semua penyakit"], 1, "Makanan tinggi lemak tanpa aktivitas fisik dapat meningkatkan risiko obesitas.", "⚖️"],
  ["Vitamin & Mineral", "Pandangan kakek agak kabur saat malam hari. Ia disarankan banyak makan wortel untuk menjaga mata karena mengandung...", ["Vitamin A", "Vitamin B", "Vitamin C", "Vitamin D"], 0, "Vitamin A berperan penting dalam menjaga kesehatan mata.", "🥕"],
  ["Vitamin & Mineral", "Sinta rutin dibekali buah jeruk agar tidak mudah tertular flu di sekolah. Jeruk menjaga daya tahan tubuh karena kaya akan...", ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], 1, "Vitamin C membantu memelihara daya tahan tubuh.", "🍊"],
  ["Vitamin & Mineral", "Adik bayi dijemur setiap pagi agar tulangnya kuat. Sinar matahari pagi membantu tubuh mengaktifkan penyerapan kalsium melalui...", ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin E"], 2, "Vitamin D membantu tubuh menyerap kalsium untuk tulang.", "☀️"],
  ["Vitamin & Mineral", "Rini disarankan rajin minum susu. Bagi masa pertumbuhan Rini, mineral kalsium dalam susu berfungsi untuk...", ["Menjadi cadangan energi", "Memperkuat tulang dan gigi", "Mempertajam penglihatan", "Melancarkan pernapasan"], 1, "Kalsium dibutuhkan untuk pertumbuhan serta kekuatan tulang dan gigi.", "🥛"],
  ["Vitamin & Mineral", "Tika terlihat pucat dan lemas karena kurang darah (anemia). Tika membutuhkan makanan yang mengandung mineral...", ["Zat besi", "Kalsium", "Yodium", "Kalium"], 0, "Zat besi diperlukan untuk pembentukan hemoglobin dalam darah.", "🩸"],
  ["Gizi Seimbang", "Beni hanya mau makan nasi campur mi instan setiap hari tanpa lauk dan sayur. Akibat dari kebiasaan Beni adalah...", ["Kecerdasan meningkat pesat", "Pertumbuhan terhambat karena kurang vitamin dan protein", "Gizi tubuhnya otomatis seimbang", "Pencernaan menjadi sangat lancar"], 1, "Makanan yang tidak beragam dapat membuat tubuh kekurangan protein, vitamin, dan mineral.", "🍜"],
  ["Gizi Seimbang", "Menu makan siang berisi nasi, ikan, tempe, sayur bayam, dan pisang dalam porsi yang pas. Susunan menu ini disebut...", ["Makanan cepat saji", "Gizi seimbang", "Makanan instan", "Makanan organik"], 1, "Menu beragam dalam porsi tepat merupakan penerapan gizi seimbang.", "🥗"],
  ["Vitamin & Mineral", "Darah pada lutut Andi yang terluka cepat berhenti dan membeku. Proses pembekuan darah ini dibantu oleh asupan...", ["Vitamin A", "Vitamin C", "Vitamin D", "Vitamin K"], 3, "Vitamin K membantu proses pembekuan darah.", "🩹"],
  ["Vitamin & Mineral", "Pak Danu sering kesemutan dan pegal-pegal. Dokter menyarankan konsumsi kacang-kacangan untuk menjaga kesehatan saraf karena kaya akan...", ["Vitamin K", "Vitamin B kompleks", "Vitamin A", "Kalsium"], 1, "Vitamin B kompleks membantu menjaga fungsi saraf dan metabolisme energi.", "🥜"],
  ["Serat & Pencernaan", "Kakek belakangan ini susah buang air besar (sembelit). Ia disarankan banyak makan sayur dan buah yang mengandung...", ["Karbohidrat", "Serat", "Lemak", "Protein hewani"], 1, "Serat membantu melancarkan pencernaan dan mencegah sembelit.", "🥦"],
  ["Serat & Pencernaan", "Dito selalu membuang sayur dan buah dari piringnya. Akibatnya, gangguan yang paling mungkin dialami Dito adalah...", ["Sering buang air kecil", "Feses mengeras dan sembelit", "Kapasitas paru-paru membesar", "Ginjal bekerja lebih maksimal"], 1, "Kurang serat dapat membuat feses keras dan menyebabkan sembelit.", "🍎"],
  ["Air & Hidrasi", "Setelah jam olahraga siang, siswa kelas 6 segera minum air putih. Tujuan utamanya adalah untuk mencegah...", ["Massa otot mengecil", "Dehidrasi (kekurangan cairan)", "Tulang keropos", "Rabun jauh"], 1, "Air mengganti cairan tubuh yang hilang dan mencegah dehidrasi.", "💧"],
  ["Pilihan Makanan", "Ibu selalu melihat label kemasan sebelum membeli camilan di minimarket. Tujuan ibu membaca tabel gizi tersebut adalah...", ["Mengetahui cara memasaknya", "Memastikan gizinya aman dan sesuai kebutuhan keluarga", "Mencari harga paling murah", "Memastikan plastiknya bisa didaur ulang"], 1, "Tabel gizi membantu memilih makanan sesuai kebutuhan dan membatasi gula, garam, serta lemak.", "🏷️"],
  ["Isi Piringku", "Sesuai pedoman \"Isi Piringku\", piring makan siang yang sehat harus terdiri dari...", ["Nasi porsi besar dan lauk berlemak", "Karbohidrat, protein, sayur, dan buah dalam porsi seimbang", "Mi instan ganda dan minuman manis", "Buah dan sayur saja"], 1, "Isi Piringku memadukan makanan pokok, lauk, sayur, dan buah dalam porsi seimbang.", "🍽️"],
  ["Sarapan Sehat", "Sarapan Rina pagi ini adalah nasi, telur rebus, tahu, sayur sop, dan apel. Menu ini adalah contoh penerapan...", ["Pola makan tidak sehat", "Pola makan gizi seimbang", "Pola makan kurang karbohidrat", "Pola makan tinggi lemak"], 1, "Menu tersebut lengkap dan beragam sehingga termasuk pola makan gizi seimbang.", "🌅"],
  ["Malnutrisi", "Dodi terlihat kurus pucat karena uangnya hanya dipakai jajan permen dan sirop sirop manis di sekolah. Kondisi kekurangan asupan gizi ini disebut...", ["Obesitas", "Malnutrisi (kekurangan gizi)", "Pubertas dini", "Adaptasi imun"], 1, "Malnutrisi terjadi ketika tubuh tidak memperoleh zat gizi yang cukup dan seimbang.", "🍬"],
  ["Pola Makan Sehat", "Bima selalu membawa bekal gizi seimbang, sedangkan Aldo selalu bekal mi instan. Jika kebiasaan ini berlanjut, perbedaannya nanti adalah...", ["Tidak ada perbedaan fisik keduanya", "Pertumbuhan dan daya tahan tubuh Bima lebih baik dari Aldo", "Aldo tumbuh jauh lebih kuat", "Bima lebih sering sakit perut"], 1, "Gizi seimbang mendukung pertumbuhan serta daya tahan tubuh yang lebih baik.", "🍱"],
  ["Sarapan Sehat", "Tiara lemas dan mengantuk saat belajar matematika di jam pertama karena belum sarapan. Zat gizi penghasil tenaga cepat yang Tiara butuhkan adalah...", ["Vitamin K", "Protein murni", "Karbohidrat", "Mineral kalsium"], 2, "Karbohidrat merupakan sumber energi utama untuk belajar dan beraktivitas.", "📚"],
  ["Kebersihan Makanan", "Sebelum membuat salad, Hani selalu mencuci sayuran di bawah air mengalir dengan tujuan...", ["Menambah rasa gurih sayur", "Membersihkan debu, kuman, dan sisa pestisida", "Membuat sayur terlihat lebih banyak", "Mematangkan sayuran tanpa direbus"], 1, "Mencuci dengan air mengalir membantu membersihkan kotoran, kuman, dan sisa pestisida.", "🚿"],
  ["Vitamin & Mineral", "Banyak warga desa pegunungan menderita penyakit gondok (leher bengkak). Makanan mereka terbukti kekurangan mineral...", ["Kalsium", "Yodium", "Zat besi", "Kalium"], 1, "Kekurangan yodium dapat menyebabkan pembesaran kelenjar tiroid atau gondok.", "🧂"],
  ["Air & Hidrasi", "Baju Budi basah kuyup oleh keringat setelah main bola. Agar kembali segar dan sehat, Budi harus segera...", ["Minum minuman bersoda dingin", "Makan keripik yang sangat asin", "Tidur di depan kipas angin", "Minum air putih dalam jumlah cukup"], 3, "Air putih mengganti cairan yang hilang melalui keringat.", "⚽"],
  ["Serat & Pencernaan", "Kantin sekolah menyediakan buah pepaya potong murah meriah. Makan pepaya setiap hari sangat bermanfaat bagi siswa untuk...", ["Menyembuhkan luka lecet di kulit", "Melancarkan pencernaan (BAB) dan menjaga kesehatan mata", "Memperbesar massa otot lengan", "Menghangatkan tubuh saat cuaca dingin"], 1, "Pepaya kaya serat dan beta-karoten yang baik untuk pencernaan serta kesehatan mata.", "🍈"],
] as const

export const allQuestions: Question[] = rawQuestions.map((item, index) => ({
  id: index + 1,
  topic: item[0],
  level: index < 10 ? "mudah" : index < 20 ? "sedang" : "sulit",
  q: item[1],
  options: [...item[2]],
  correct: item[3],
  explanation: item[4],
  img: item[5],
}))
