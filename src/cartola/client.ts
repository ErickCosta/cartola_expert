import axios from "axios";

export function cartolaPublic() {
  return axios.create({
    timeout: 20000,
    headers: { "User-Agent": "cartola-expert/1.0" },
  });
}
