import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 生成 UUID v4
 */
export function generateUUID(): string {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (parseInt(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (parseInt(c) / 4)))).toString(16)
  );
}

/**
 * 获取浏览器当前定位对应的地址。
 * 立即返回缓存地址或兜底文本，定位和反向地理编码在后台更新缓存。
 */
export async function getCurrentAddress(): Promise<string> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    return "未知地址";
  }

  const cachedAddress = window.localStorage.getItem("current_address");
  void refreshCurrentAddress();
  return cachedAddress || "未知地址";
}

async function refreshCurrentAddress(): Promise<void> {
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 3000,
        maximumAge: 300000,
      });
    });

    const {latitude, longitude} = position.coords;
    const response = await fetch(
      `/nominatim/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json() as {
      address?: {
        state?: string;
        province?: string;
        city?: string;
        county?: string;
        district?: string;
        city_district?: string;
      };
    };
    const address = data.address;
    if (!address) {
      return;
    }

    const district = address.district || address.city_district || address.county;
    const parts = [address.province || address.state, address.city, district]
      .filter((part): part is string => Boolean(part))
      .filter((part, index, values) => values.indexOf(part) === index);

    const resolvedAddress = parts.join("");
    if (resolvedAddress) {
      window.localStorage.setItem("current_address", resolvedAddress);
    }
  } catch {
    // 定位或反向地理编码失败时保留已有缓存，不影响聊天请求。
  }
}
