import type { InterviewQuestion } from "../types";

export const seedQuestions: InterviewQuestion[] = [
  {
    id: "seed-react-state",
    title: "Khi nao nen tach state ra khoi component?",
    question:
      "Trong React, dau hieu nao cho thay state dang nam sai cho va nen dua len parent, context, hoac store rieng?",
    answer:
      "Nen tach state khi nhieu component can doc/ghi cung mot du lieu, khi logic cap nhat qua phuc tap, hoac khi component bi render lai vi nhung du lieu khong lien quan. Dua state len parent neu pham vi chia se nho, dung context cho du lieu doc nhieu nhu theme/user, va store rieng khi can workflow lon, cache, optimistic update, hoac debug time-travel.",
    category: "Frontend",
    role: "React Developer",
    level: "Junior",
    tags: ["react", "state", "architecture"],
    source: "Internal notes",
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "seed-node-event-loop",
    title: "Event loop trong Node.js hoat dong the nao?",
    question:
      "Hay giai thich event loop, microtask queue va vi sao mot tac vu CPU-bound co the lam cham server Node.js.",
    answer:
      "Node.js chay JavaScript tren mot main thread. I/O bat dong bo duoc uy quyen cho system/libuv, callback quay lai event loop theo tung phase. Promise callbacks va queueMicrotask la microtasks nen chay truoc khi event loop sang phase tiep theo. CPU-bound task chiem main thread se chan callback khac, nen can tach qua worker threads, queue job, hoac service rieng.",
    category: "Backend",
    role: "Node.js Developer",
    level: "Middle",
    tags: ["nodejs", "event-loop", "performance"],
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "seed-sql-index",
    title: "Index database giup va hai nhu the nao?",
    question:
      "Giai thich trade-off cua index trong SQL database va cach chon cot de tao index.",
    answer:
      "Index giup doc nhanh hon bang cach tao cau truc du lieu phu, thuong la B-tree, de tim row ma khong scan toan bo bang. Doi lai, index ton dung luong va lam write cham hon vi insert/update/delete phai cap nhat index. Nen index cot hay dung trong WHERE, JOIN, ORDER BY, co do phan tan tot, va can do bang voi composite index theo thu tu truy van thuc te.",
    category: "Database",
    role: "Backend Developer",
    level: "Junior",
    tags: ["sql", "index", "database"],
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "seed-system-rate-limit",
    title: "Thiet ke rate limiter co ban",
    question:
      "Neu API can gioi han 100 requests moi phut cho moi user, ban se thiet ke nhu the nao?",
    answer:
      "Co the dung fixed window, sliding window, token bucket hoac leaky bucket. Token bucket phu hop khi muon cho phep burst nho: moi user co bucket trong Redis, refill theo thoi gian, moi request tru token. Can TTL de don key cu, atomic operation de tranh race condition, va response 429 kem retry-after khi het token.",
    category: "System Design",
    role: "Backend Developer",
    level: "Senior",
    tags: ["system-design", "redis", "api"],
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "seed-behavior-conflict",
    title: "Ke ve lan ban bat dong voi teammate",
    question:
      "Hay mo ta mot tinh huong ban khong dong y voi teammate va cach ban xu ly.",
    answer:
      "Cau tra loi nen theo STAR: situation, task, action, result. Tap trung vao cach ban lam ro muc tieu chung, dua ra du lieu, lang nghe trade-off cua nguoi kia, thu nho quyet dinh bang spike/prototype neu can, va ket thuc bang ket qua do duoc. Tranh bien cau chuyen thanh do loi ca nhan.",
    category: "Behavioral",
    role: "Any Role",
    level: "Intern",
    tags: ["behavioral", "communication", "star"],
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "seed-testing-pyramid",
    title: "Testing pyramid co y nghia gi?",
    question:
      "Vi sao mot team khong nen chi dua vao end-to-end tests de dam bao chat luong?",
    answer:
      "Testing pyramid khuyen co nhieu unit tests, it integration tests hon, va mot lop E2E mong cho cac luong quan trong. E2E gan voi hanh vi nguoi dung nhung cham, de flaky va kho debug. Unit/integration tests nhanh hon, khoanh vung loi tot hon. Thuc te co the dieu chinh thanh testing trophy tuy ung dung, nhung van can can bang toc do, do tin cay va muc do tu tin.",
    category: "Quality",
    role: "QA / Developer",
    level: "Middle",
    tags: ["testing", "quality", "e2e"],
    createdAt: "2026-06-10T00:00:00.000Z",
  },
];
