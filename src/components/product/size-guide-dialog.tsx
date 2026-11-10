"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { SizeChartRow } from "@/types/catalog"

export function SizeGuideDialog({ rows, categoryName }: { rows: SizeChartRow[]; categoryName: string }) {
  if (rows.length === 0) return null
  const hasChest = rows.some((r) => r.chest !== null)

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="link" size="sm" className="text-xs text-muted-foreground underline" />}>
        Hướng dẫn chọn size
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bảng size {categoryName}</DialogTitle>
          <DialogDescription>
            Số đo tham khảo, đơn vị cm (chiều cao) và kg (cân nặng). Nếu ở giữa hai size, hãy chọn size lớn hơn.
          </DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Size</TableHead>
              {hasChest && <TableHead>Ngực (cm)</TableHead>}
              <TableHead>Eo (cm)</TableHead>
              <TableHead>Mông (cm)</TableHead>
              <TableHead>Chiều cao (cm)</TableHead>
              <TableHead>Cân nặng (kg)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.size}>
                <TableCell className="font-bold">{r.size}</TableCell>
                {hasChest && <TableCell>{r.chest ?? "—"}</TableCell>}
                <TableCell>{r.waist}</TableCell>
                <TableCell>{r.hip}</TableCell>
                <TableCell>
                  {r.heightMin}–{r.heightMax}
                </TableCell>
                <TableCell>
                  {r.weightMin}–{r.weightMax}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  )
}

