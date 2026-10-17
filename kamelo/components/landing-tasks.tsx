"use client";

import { useState } from "react";

const tasks = ["Bersihkan kamar 04", "Cek AC kamar 05", "Siapkan kamar 06"];

export function LandingTasks() {
  const [done, setDone] = useState([true, false, false]);
  return (
    <div className="journal-task-demo" aria-label="Contoh pekerjaan staf">
      <ul>
        {tasks.map((task, index) => (
          <li key={task}>
            <label>
              <input
                type="checkbox"
                aria-label={task}
                checked={done[index]}
                onChange={(event) =>
                  setDone((previous) =>
                    previous.map((value, i) =>
                      i === index ? event.target.checked : value,
                    ),
                  )
                }
              />
              <span>
                <b>{task}</b>
                <small>{done[index] ? "Selesai" : "Belum selesai"}</small>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p role="status">
        {done.filter(Boolean).length} dari 3 selesai · perubahan hanya di demo.
      </p>
    </div>
  );
}
