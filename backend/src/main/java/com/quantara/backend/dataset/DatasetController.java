package com.quantara.backend.dataset;

import com.quantara.backend.auth.AccountPrincipal;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/datasets")
public class DatasetController {
    private final DatasetService datasets;
    public DatasetController(DatasetService datasets) { this.datasets=datasets; }
    @GetMapping
    public Object list(@AuthenticationPrincipal AccountPrincipal user) { return datasets.list(user.id()); }
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Object upload(@AuthenticationPrincipal AccountPrincipal user, @RequestParam("file") MultipartFile file) { return summary(datasets.upload(user.id(),file)); }
    @PostMapping("/demo")
    public Object demo(@AuthenticationPrincipal AccountPrincipal user) { return summary(datasets.demo(user.id())); }
    @GetMapping("/{id}")
    public Object detail(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id) { return summary(datasets.get(user.id(),id)); }
    @PatchMapping("/{id}")
    public Object rename(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id,@RequestBody Map<String,String> body) { datasets.rename(user.id(),id,body.get("name"));return summary(datasets.get(user.id(),id)); }
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id) { datasets.delete(user.id(),id); }

    @GetMapping("/{id}/rows")
    public Object rows(@AuthenticationPrincipal AccountPrincipal user,@PathVariable UUID id,
                       @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="25") int size,
                       @RequestParam(defaultValue="") String search,@RequestParam(defaultValue="") String sort,
                       @RequestParam(defaultValue="asc") String direction,@RequestParam(defaultValue="") String column,
                       @RequestParam(defaultValue="") String value) {
        var dataset=datasets.get(user.id(),id);
        if(page<0||size<1||size>100||search.length()>200||value.length()>200)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid pagination or filter");
        var filtered = dataset.rows().stream().filter(row->search.isBlank()||row.values().stream().anyMatch(v->v!=null&&v.toString().toLowerCase(Locale.ROOT).contains(search.toLowerCase(Locale.ROOT))))
                .filter(row->column.isBlank()||Objects.toString(row.get(column),"").toLowerCase(Locale.ROOT).contains(value.toLowerCase(Locale.ROOT))).collect(Collectors.toCollection(ArrayList::new));
        if(!sort.isBlank()) {
            if(dataset.columns().stream().noneMatch(c->c.name().equals(sort)))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown sort column");
            Comparator<Map<String,Object>> comparator=(a,b)->compare(a.get(sort),b.get(sort));
            filtered.sort(direction.equals("desc")?comparator.reversed():comparator);
        }
        long start=(long)page*size;
        return Map.of("rows",filtered.subList((int)Math.min(start,filtered.size()),(int)Math.min(start+size,filtered.size())),"total",filtered.size(),"page",page,"size",size);
    }

    private int compare(Object a,Object b){ if(a==null)return b==null?0:1;if(b==null)return -1;if(a instanceof Number n&&b instanceof Number m)return Double.compare(n.doubleValue(),m.doubleValue());return a.toString().compareToIgnoreCase(b.toString()); }
    private Object summary(DatasetService.Dataset d) {
        var suggestions=new ArrayList<String>();
        d.columns().stream().filter(c->c.missing()>0).forEach(c->suggestions.add(c.name()+": "+c.missing()+" missing values. Review before filling or excluding rows."));
        long duplicate=d.rowCount()-new HashSet<>(d.rows()).size();
        if(duplicate>0)suggestions.add(duplicate+" duplicate rows detected. Review whether these are repeated events or accidental duplicates.");
        if(suggestions.isEmpty())suggestions.add("No missing values or exact duplicate rows detected. Review business rules before analysis.");
        return Map.of("id",d.id(),"name",d.name(),"filename",d.filename(),"columns",d.columns(),"rowCount",d.rowCount(),"qualityScore",d.qualityScore(),"demo",d.demo(),"createdAt",d.createdAt(),"suggestions",suggestions,"duplicateRows",duplicate);
    }
}
