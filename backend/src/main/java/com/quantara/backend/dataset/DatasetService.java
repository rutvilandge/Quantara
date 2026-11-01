package com.quantara.backend.dataset;

import com.quantara.backend.workspace.WorkspaceEvents;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.*;
import org.apache.commons.csv.CSVFormat;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.ObjectMapper;

@Service
public class DatasetService {
    public static final int MAX_ROWS = 10_000;
    public static final int MAX_COLUMNS = 50;
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final WorkspaceEvents events;
    public DatasetService(JdbcTemplate jdbc, ObjectMapper json, WorkspaceEvents events) {
        this.jdbc = jdbc; this.json = json; this.events = events;
        ZipSecureFile.setMaxEntrySize(20 * 1024 * 1024);
    }

    public record Column(String name, String sourceName, String type, int missing, long distinct,
                         Double minimum, Double maximum, Double mean) {}
    public record Dataset(UUID id, String name, String filename, List<Column> columns,
                          List<Map<String,Object>> rows, int rowCount, double qualityScore,
                          boolean demo, String createdAt) {}

    public List<Map<String,Object>> list(UUID owner) {
        return jdbc.queryForList("SELECT id, name, filename, row_count, quality_score, is_demo, created_at, jsonb_array_length(columns_json) AS column_count FROM datasets WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100", owner);
    }

    @SuppressWarnings("unchecked")
    private Dataset map(ResultSet rs, int row) throws SQLException {
        List<Map<String,Object>> rows = (List<Map<String,Object>>)(List<?>) Arrays.asList(json.readValue(rs.getString("rows_json"), Map[].class));
        return new Dataset(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("filename"),
                Arrays.asList(json.readValue(rs.getString("columns_json"), Column[].class)), rows,
                rs.getInt("row_count"), rs.getDouble("quality_score"), rs.getBoolean("is_demo"), rs.getString("created_at"));
    }

    public Dataset get(UUID owner, UUID id) {
        return jdbc.query("SELECT * FROM datasets WHERE id = ? AND owner_id = ?", this::map, id, owner)
                .stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Dataset not found"));
    }

    @Transactional
    public Dataset upload(UUID owner, MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 5 * 1024 * 1024) bad("Choose a nonempty file up to 5 MB");
        String filename = Objects.requireNonNullElse(file.getOriginalFilename(), "dataset.csv").replace('\\','/');
        filename = filename.substring(filename.lastIndexOf('/')+1);
        if (filename.length() > 200) bad("Filename is too long");
        var raw = new ArrayList<List<String>>();
        try {
            if (filename.toLowerCase(Locale.ROOT).endsWith(".csv")) {
                try (var reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
                     var parser = CSVFormat.DEFAULT.builder().setIgnoreEmptyLines(true).setTrim(true).get().parse(reader)) {
                    for (var record : parser) {
                        if (raw.size() > MAX_ROWS) bad("The limit is 10,000 data rows per dataset");
                        if (record.size() > MAX_COLUMNS) bad("The limit is 50 columns per dataset");
                        var values = new ArrayList<String>();
                        for (String cell : record) { if (cell.length() > 10_000) bad("A cell exceeds 10,000 characters"); values.add(cell); }
                        raw.add(values);
                    }
                }
            } else if (filename.toLowerCase(Locale.ROOT).endsWith(".xlsx")) {
                try (var workbook = new XSSFWorkbook(file.getInputStream())) {
                    if (workbook.getNumberOfSheets() == 0) bad("The workbook is empty");
                    var sheet = workbook.getSheetAt(0);
                    if (sheet.getLastRowNum() > MAX_ROWS) bad("The limit is 10,000 data rows per dataset");
                    var formatter = new DataFormatter(Locale.ROOT);
                    for (var row : sheet) {
                        if (row.getLastCellNum() > MAX_COLUMNS) bad("The limit is 50 columns per dataset");
                        var values = new ArrayList<String>();
                        for (int c=0;c<row.getLastCellNum();c++) {
                            String cell = formatter.formatCellValue(row.getCell(c));
                            if (cell.length() > 10_000) bad("A cell exceeds 10,000 characters");
                            values.add(cell);
                        }
                        raw.add(values);
                    }
                }
            } else { bad("Only UTF-8 CSV and XLSX files are supported"); }
        } catch (ResponseStatusException error) {
            throw error;
        } catch (IOException | RuntimeException error) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The file could not be parsed. Check its format.");
        }
        return save(owner, filename.replaceFirst("(?i)\\.(csv|xlsx)$", ""), filename, raw, false);
    }

    @Transactional
    public Dataset demo(UUID owner) {
        var existing = jdbc.queryForList("SELECT id FROM datasets WHERE owner_id = ? AND is_demo = TRUE LIMIT 1", UUID.class, owner);
        if (!existing.isEmpty()) return get(owner, existing.getFirst());
        var raw = new ArrayList<List<String>>();
        raw.add(List.of("order_id", "date", "customer_id", "product", "category", "region", "channel", "quantity", "unit_price", "discount", "revenue", "cost", "profit", "returned"));
        String[] products = {"Laptop Pro", "Monitor 4K", "Wireless Audio", "Desk Lamp", "Running Shoes", "Cotton Shirt", "Coffee Maker", "Travel Backpack"};
        String[] categories = {"Electronics", "Electronics", "Electronics", "Home", "Fashion", "Fashion", "Home", "Accessories"};
        int[] prices = {74999,29999,4999,2499,3999,1499,6499,2999};
        String[] regions = {"West", "North", "South", "East"};
        var random = new Random(42);
        for (int i=0;i<750;i++) {
            int product=random.nextInt(products.length);
            int quantity=1+random.nextInt(4);
            LocalDate day=LocalDate.of(2025,1,1).plusDays(i*365L/750);
            double discount=(i%11==0?.2:i%5==0?.1:0);
            double revenue=Math.round(prices[product]*quantity*(1-discount)*100)/100.0;
            double cost=Math.round(prices[product]*quantity*(.55+random.nextDouble()*.18)*100)/100.0;
            raw.add(List.of("ORD-"+(10001+i),day.toString(),"C-"+(100+random.nextInt(180)),products[product],categories[product],regions[random.nextInt(4)],
                    random.nextDouble()<.68?"Online":"Marketplace",String.valueOf(quantity),String.valueOf(prices[product]),String.valueOf(discount),
                    String.valueOf(revenue),String.valueOf(cost),String.valueOf(Math.round((revenue-cost)*100)/100.0),String.valueOf(random.nextDouble()<.045)));
        }
        return save(owner, "E-commerce Sales · Synthetic demo", "synthetic-ecommerce-sales.csv", raw, true);
    }

    private Dataset save(UUID owner, String name, String filename, List<List<String>> raw, boolean demo) {
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM datasets WHERE owner_id = ?", Integer.class, owner);
        if (count != null && count >= 100) bad("The workspace limit is 100 datasets");
        if (raw.size()<2 || raw.getFirst().isEmpty()) bad("Include a header row and at least one data row");
        int width = raw.getFirst().size();
        var names = new ArrayList<String>();
        for (int c=0;c<width;c++) {
            String nameBase = raw.getFirst().get(c).replace("\uFEFF", "").trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
            if (nameBase.isEmpty()) nameBase = "column_"+(c+1);
            if (Character.isDigit(nameBase.charAt(0))) nameBase = "column_"+nameBase;
            if (nameBase.length()>50) nameBase=nameBase.substring(0,50);
            String normalized=nameBase;
            for (int n=2;names.contains(normalized);n++) normalized=nameBase+"_"+n;
            names.add(normalized);
        }
        var rows = new ArrayList<Map<String,Object>>();
        for (int r=1;r<raw.size();r++) {
            if (raw.get(r).size()>width) bad("A data row contains more fields than the header");
            var row = new LinkedHashMap<String,Object>();
            for (int c=0;c<width;c++) { String cell=c<raw.get(r).size()?raw.get(r).get(c).trim():""; row.put(names.get(c), cell.isEmpty()?null:cell); }
            rows.add(row);
        }
        var columns = new ArrayList<Column>();
        int allMissing=0;
        for (int c=0;c<width;c++) {
            String key=names.get(c);
            var values=rows.stream().map(r->r.get(key)).filter(Objects::nonNull).map(Object::toString).toList();
            int missing=rows.size()-values.size(); allMissing+=missing;
            String type = !values.isEmpty() && values.stream().allMatch(this::numeric) ? "number"
                    : !values.isEmpty() && values.stream().allMatch(v->v.equalsIgnoreCase("true")||v.equalsIgnoreCase("false")) ? "boolean"
                    : !values.isEmpty() && values.stream().allMatch(this::isoDate) ? "date" : "text";
            Double min=null,max=null,mean=null;
            if (type.equals("number")) {
                var stats=values.stream().mapToDouble(Double::parseDouble).summaryStatistics();
                min=stats.getMin();max=stats.getMax();mean=stats.getAverage();
                rows.forEach(row->{ if(row.get(key)!=null)row.put(key,Double.parseDouble(row.get(key).toString())); });
            } else if(type.equals("boolean")) { rows.forEach(row->{ if(row.get(key)!=null)row.put(key,Boolean.parseBoolean(row.get(key).toString())); }); }
            columns.add(new Column(key,raw.getFirst().get(c),type,missing,values.stream().distinct().count(),min,max,mean));
        }
        UUID id=UUID.randomUUID();
        double quality=Math.round((1.0-(double)allMissing/(rows.size()*width))*1000)/10.0;
        jdbc.update("INSERT INTO datasets(id,owner_id,name,filename,columns_json,rows_json,row_count,quality_score,is_demo) VALUES (?,?,?,?,?::jsonb,?::jsonb,?,?,?)",
                id,owner,name.substring(0,Math.min(name.length(),150)),filename,json.writeValueAsString(columns),json.writeValueAsString(rows),rows.size(),quality,demo);
        events.record(owner,"dataset",(demo?"Created synthetic demo: ":"Uploaded ")+name);
        return get(owner,id);
    }

    private boolean numeric(String value) { try { if(value.matches("[-+]?0[0-9]+")||value.matches("[-+]?[0-9]{16,}"))return false;return Double.isFinite(Double.parseDouble(value)); } catch(NumberFormatException e) { return false; } }
    private boolean isoDate(String value) { try { LocalDate.parse(value);return true; }catch(Exception e){return false;} }

    public Dataset filter(Dataset source,String dateColumn,String from,String to,String categoryColumn,String categoryValue) {
        boolean dateFilter=(from!=null&&!from.isBlank())||(to!=null&&!to.isBlank());
        boolean categoryFilter=categoryColumn!=null&&!categoryColumn.isBlank()&&categoryValue!=null;
        if(!dateFilter&&!categoryFilter)return source;
        if(dateFilter&&source.columns().stream().noneMatch(c->c.name().equals(dateColumn)&&c.type().equals("date")))bad("Choose a date column to apply a date filter");
        if(categoryFilter&&source.columns().stream().noneMatch(c->c.name().equals(categoryColumn)))bad("Unknown category filter column");
        LocalDate start=from==null||from.isBlank()?null:LocalDate.parse(from);
        LocalDate end=to==null||to.isBlank()?null:LocalDate.parse(to);
        if(start!=null&&end!=null&&start.isAfter(end))bad("The start date must be before the end date");
        var filtered=source.rows().stream().filter(row->{
            if(categoryFilter&&!Objects.toString(row.get(categoryColumn),"").equals(categoryValue))return false;
            if(!dateFilter)return true;
            Object value=row.get(dateColumn);if(value==null)return false;LocalDate day=LocalDate.parse(value.toString());
            return (start==null||!day.isBefore(start))&&(end==null||!day.isAfter(end));
        }).toList();
        return new Dataset(source.id(),source.name(),source.filename(),source.columns(),filtered,filtered.size(),source.qualityScore(),source.demo(),source.createdAt());
    }
    private void bad(String message) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,message); }

    @Transactional
    public void rename(UUID owner, UUID id, String name) {
        get(owner,id);
        if(name==null||name.isBlank()||name.length()>150)bad("Name must contain 1 to 150 characters");
        jdbc.update("UPDATE datasets SET name=? WHERE id=? AND owner_id=?",name.trim(),id,owner);
        events.record(owner,"dataset","Renamed dataset to "+name.trim());
    }
    @Transactional
    public void delete(UUID owner, UUID id) {
        var dataset=get(owner,id);
        jdbc.update("DELETE FROM datasets WHERE id=? AND owner_id=?",id,owner);
        events.record(owner,"dataset","Deleted dataset "+dataset.name());
    }
}
