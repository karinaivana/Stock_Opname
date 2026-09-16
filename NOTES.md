# NOTES.md — Stock Opname & Async Reconciliation

## 1. Walk through what happens, in your system, from the moment a manager clicks approve to the moment stock levels are updated. What could go wrong at each step, and what did you do about it?

Proses yang terjadi setelah “Manajer Gudang” melakukan approve terhadap sesi “Stock Opname”:

1. Manajer melakukan approve terhadap hasil perhitungan fisik yang dilakukan oleh staff gudang pada halaman Tinjau Selisih.
2. Sistem akan mengubah status sesi “Stock Opname” menjadi `APPROVED` dan mengembalikan status code 200 tanpa mengubah kuantitas stock atas SKU yang terdampak.
3. Menambahkan queue untuk reconciliation jobs dengan FK sesi id dengan status `PENDING`.
4. Jika ada manager gudang lainnya yang melakukan approve, sistem akan melakukan pengecekan apakah terdapat job atas sesi id tersebut di dalam table. Hal ini menyebabkan sistem tidak akan menambahkan antrean job baru dengan sesi yang sama.
5. Sistem memiliki scheduler yang akan terus berjalan untuk memproses update stok. Jika dalam prosesnya dia tidak menemukan job yang bisa diproses, maka job akan sleep selama 2 detik terlebih dahulu.

Pada job scheduler tersebut, terjadi hal-hal berikut ini:

5.1. Melakukan update status reconciliation jobs menjadi `PENDING` jika job masih di status `PROCESSING` lebih dari 5 menit, atau job berstatus `FAILED` dengan `attempts < RECONCILE_MAX_ATTEMPTS` (default 3)
5.2. Memproses jobs yang berstatus `PENDING` dengan waktu pending tertua (`created_at` asc) dengan mengunci baris tersebut sehingga tidak ada yang dapat mengubah data row (kunci dengan `FOR UPDATE SKIP LOCKED`)
5.3. Update status job menjadi `PROCESSING` dan status sesi menjadi `RECONCILING`
5.4. Ambil semua SKU yang termasuk ke dalam sesi opname (`session_items` dengan `session_id` di atas)
5.5. Update value set stock on-hand dari hasil hitungan fisik di gudang
5.6. Jika data stock-on-hand dan hasil perhitungan fisik berbeda, maka masukkan SKU tersebut ke dalam `inventory_audit_logs` dengan `session_id`-nya
5.7. Setelah seluruh proses selesai, status sesi menjadi `COMPLETED` dan status reconciliation jobs menjadi `DONE`
5.8. Update stock on-hand menggunakan nilai absolut dari hasil hitungan fisik (`counted`), bukan menambah/mengurangi selisih. Hal ini mencegah stok dobel jika job dijalankan ulang.
5.9. Jika sesi sudah berstatus `COMPLETED`, maka jobs tidak melakukan perubahan stok hanya menandai job sebagai `DONE`.
5.10. Jika proses gagal di tengah jalan, transaksi akan di-rollback sehingga tidak ada stok yang ter-update setengah. Job tersebut akan diulang secara otomatis selama < 3 percobaan

---

## 2. What's one part of the brief where you made an assumption because a rule wasn't fully specified? What did you assume, and why?

Berikut hal yang saya buatkan asumsi pribadi:

1. **Stok per gudang × SKU**
  Dikarenakan 1 SKU yang sama dapat dipakai di beberapa gudang, maka stock on-hand disimpan terpisah per kombinasi gudang × SKU. Contoh: Jakarta dan Bogor bisa punya angka on-hand berbeda untuk SKU yang sama, sehingga perubahan di satu gudang tidak ikut mengubah gudang lain.
2. **Stok awal diisi sekali, lalu dikunci**
  Setelah 1 SKU di-assign ke suatu gudang, sistem belum menyimpan stock on-hand untuk SKU tersebut. Sistem menyediakan halaman “Stock Awal” sehingga Admin Inventori dapat set stock awal untuk setiap SKU yang baru dimasukkan ke dalam gudang mereka.
3. **Sesi akan ditutup** setelah manager Gudang menolak hasil perhitungan fisik atas suatu stock opname. Hal ini dilakukan agar hanya terdapat 1 sesi stock opname yang active per gudang (Module ini masih mungkin untuk di-improve).

---

## 3. What are some edge cases you thought of and how did you handle them?

Berikut edge cases yang saya handle:

1. Staff Gudang tidak dapat melakukan input negatif karena tidak mungkin barang di gudang minus
2. Staff Gudang dapat menginput jumlah barang 0 jika barang tidak ditemukan
3. Menggunakan begin transaction dan commit transaction untuk memastikan tidak ada perubahan stok-on-hand jika terdapat kegagalan proses di tengah jalan
4. Jika setelah sesi stock-opname, SKU abc tidak memiliki selisih perhitungan dengan check fisik maka SKU abc tidak dimasukkan ke row audit
5. Hanya boleh 1 sesi stock-opname yang aktif di 1 gudang. Jika 1 gudang dalam proses stock-opname, maka Manager Gudang tidak dapat melakukan sesi stock-opname lainnya.
6. Staff Gudang hanya dapat melakukan submit hitungan saat status `COUNTING`. Di luar status tersebut, form staff hanya view-only. Approve atau reject dilakukan oleh Manager Gudang saat status `SUBMITTED`.
7. Dalam proses update data SKU dari stock-opname, hanya stock SKU di gudang yang melaksanakan sesi yang dapat diupdate valuenya (Isolasi Gudang).
8. Selama job/worker tidak berjalan (mati), proses reconciliation akan ter-pending sampai worker aktif kembali
9. Jika worker crash di tengah transaksi, proses di-rollback otomatis sehingga stok tidak ter-update setengah; job bisa tetap `PENDING` lalu di-claim ulang. Jika error tertangkap, status reconciliation_jobs diubah menjadi `FAILED` lalu di-retry otomatis selama `attempts < RECONCILE_MAX_ATTEMPTS`
10. Gagalnya proses reconciliation dibatasi oleh RECONCILE_MAX_ATTEMPTS (default 3)

---

## 4. What is one thing you added to this project that you think is important? Why?

Untuk satu bagian penting dalam project yang saya tambahkan adalah dalam proses pembuatan Stock Keeping Unit (SKU). Setiap pembuatan SKU, user dapat melakukan pendaftaran SKU dengan beberapa satuan hitung.

Sebagai contoh, di dalam gudang xyz terdapat tempat makan yang memiliki hitungan dasar lusin (1 lusin dibungkus dalam 1 plastik). Plastik-plastik tersebut dimasukkan ke dalam 1 kardus besar (1 kardus berisikan 20 plastik). Jika di gudang terdapat 5 kardus dan 2 plastik tempat makan, maka di dalamnya terdapat `(5 × 20) + (2 × 1) = 102` lusin tempat makan.

Hal ini dilakukan karena:

1. Dalam proses penyimpanan 1 SKU dapat disimpan dalam beberapa bentuk hitungan. SKU gelas plastik dapat disimpan dalam bentuk kardus. Dalam 1 kardus memungkinkan berisikan banyak plastik yang berisikan pack gelas plastik
2. Jika tidak ada beberapa satuan hitung (yang bisa dikonversi), maka proses perhitungan yang dilakukan oleh staff gudang akan menjadi lebih sulit

