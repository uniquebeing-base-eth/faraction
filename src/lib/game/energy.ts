/**
 * Energy boosts sold in the Black Market.
 *
 * A fighter's energy pool decides which cards it can hold. Each boost is a
 * one-off purchase in $FACTS that permanently raises one fighter's pool.
 */
import { cdnAsset } from "@/lib/assets";
import sparkPointer from "@/assets/img/energy-spark.png.asset.json";
import surgePointer from "@/assets/img/energy-surge.png.asset.json";
import corePointer from "@/assets/img/energy-core.png.asset.json";
import overdrivePointer from "@/assets/img/energy-overdrive.png.asset.json";
import ascensionPointer from "@/assets/img/energy-ascension.png.asset.json";

export interface EnergyItem {
  id: string;
  name: string;
  energy: number;
  price: number;
  image: string;
}

export const ENERGY_ITEMS: EnergyItem[] = [
  {
    id: "spark",
    name: "Energy Spark",
    energy: 1,
    price: 1_000_000,
    image: cdnAsset(sparkPointer.url),
  },
  {
    id: "surge",
    name: "Energy Surge",
    energy: 2,
    price: 2_500_000,
    image: cdnAsset(surgePointer.url),
  },
  {
    id: "core",
    name: "Energy Core",
    energy: 3,
    price: 5_000_000,
    image: cdnAsset(corePointer.url),
  },
  {
    id: "overdrive",
    name: "Energy Overdrive",
    energy: 4,
    price: 8_000_000,
    image: cdnAsset(overdrivePointer.url),
  },
  {
    id: "ascension",
    name: "Energy Ascension",
    energy: 5,
    price: 12_000_000,
    image: cdnAsset(ascensionPointer.url),
  },
];
