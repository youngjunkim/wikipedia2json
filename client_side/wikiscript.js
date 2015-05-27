/*! wtf_wikipedia 
 by @spencermountain
 2014-11-28 */
//split text into sentences, using regex
//@spencermountain MIT
//
var sentence_parser = function(text) {
  "use strict";

  //if this looks like a period within a wikipedia link, return false
  var unbalanced=function(str){
    var open= str.match(/\[\[/) || []
    var closed= str.match(/\]\]/) || []
    return open.length > closed.length
  }

  // first, do a greedy split
  var tmp = text.split(/(\S.+?[.\?])(?=\s+|$|")/g);
  var sentences = [];
  var abbrevs = ["jr", "mr", "mrs", "ms", "dr", "prof", "sr", "sen", "corp", "calif", "rep", "gov", "atty", "supt", "det", "rev", "col", "gen", "lt", "cmdr", "adm", "capt", "sgt", "cpl", "maj", "dept", "univ", "assn", "bros", "inc", "ltd", "co", "corp", "arc", "al", "ave", "blvd", "cl", "ct", "cres", "exp", "rd", "st", "dist", "mt", "ft", "fy", "hwy", "la", "pd", "pl", "plz", "tce", "Ala", "Ariz", "Ark", "Cal", "Calif", "Col", "Colo", "Conn", "Del", "Fed", "Fla", "Ga", "Ida", "Id", "Ill", "Ind", "Ia", "Kan", "Kans", "Ken", "Ky", "La", "Me", "Md", "Mass", "Mich", "Minn", "Miss", "Mo", "Mont", "Neb", "Nebr", "Nev", "Mex", "Okla", "Ok", "Ore", "Penna", "Penn", "Pa", "Dak", "Tenn", "Tex", "Ut", "Vt", "Va", "Wash", "Wis", "Wisc", "Wy", "Wyo", "USAFA", "Alta", "Ont", "QuÔøΩ", "Sask", "Yuk", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "sept", "vs", "etc", "esp", "llb", "md", "bl", "phd", "ma", "ba", "miss", "misses", "mister", "sir", "esq", "mstr", "lit", "fl", "ex", "eg", "sep", "sept", ".."];
  var abbrev = new RegExp("(^| )(" + abbrevs.join("|") + ")[.] ?$", "i");
  //loop through and evaluate greedy splits
  for (var i in tmp) {
    if (tmp[i]) {
      tmp[i] = tmp[i].replace(/^\s+|\s+$/g, "");
      //if this does not look like a good sentence, prepend to next one
      if (tmp[i].match(abbrev) || tmp[i].match(/[ |\.][A-Z]\.?$/) || unbalanced(tmp[i])) {
        tmp[parseInt(i) + 1] = tmp[i] + " " + tmp[parseInt(i) + 1];
      } else {
        sentences.push(tmp[i]);
        tmp[i] = "";
      }
    }
  }
  //post-process the text
  var clean = [];
  for (i in sentences) {
    sentences[i] = sentences[i].replace(/^\s+|\s+$/g, "");
    if (sentences[i]) {
      clean.push(sentences[i]);
    }
  }
  // if there's no proper sentence, just return [self]
  if (clean.length == 0) {
    return [text]
  }
  return clean;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = sentence_parser;
}
// console.log(sentence_parser('Tony is nice. He lives in Japan.').length == 2)
// console.log(sentence_parser('I like that Color').length == 1)
// console.log(sentence_parser("Soviet bonds to be sold in the U.S. market. Everyone wins.").length == 2)
// console.log(sentence_parser("Hi there Dr. Joe, the price is 4.59 for N.A.S.A. Ph.Ds. I hope that's fine, etc. and you can attend Feb. 8th. Bye").length==3)
// console.log(sentence_parser("Mount Sinai Hospital, [[St. Michaels Hospital (Toronto)|St. Michaels Hospital]], North York").length==1)
// console.log(sentence_parser("he said ... oh yeah. I did").length==2)

//turns wikimedia script into json
// https://github.com/spencermountain/wtf_wikipedia
//@spencermountain
var wtf_wikipedia=(function(){
    "use strict";
    if (typeof module !== 'undefined' && module.exports) {
      var sentence_parser= require("./sentence_parser")
    }

    //find all the pairs of '[[...[[..]]...]]' in the text
    //used to properly root out recursive template calls, [[.. [[...]] ]]
    function recursive_matches(opener, closer, text){
      var out=[]
      var last=[]
      var chars=text.split('')
      var open=0
      for(var i=0; i<chars.length; i++){
        // console.log(chars[i] + "  "+open)
        if(chars[i]==opener && chars[i+1] && chars[i+1]==opener){
          open+=1
        }
        if(open>=0){
          last.push(chars[i])
        }
        if(open<=0 && last.length>0){
          //first, fix botched parse
          var open_count=last.filter(function(s){return s==opener})
          var close_count=last.filter(function(s){return s==closer})
          if(open_count.length > close_count.length){
            last.push(closer)
          }
          out.push(last.join(''))
          last=[]
        }
        if(chars[i]==closer && chars[i+1] && chars[i+1]==closer){ //this introduces a bug for "...]]]]"
          open-=1
          if(open<0){
            open=0
          }
        }
      }
      return out
    }


    var helpers={
      capitalise:function(str){
        if(str && typeof str=="string"){
          return str.charAt(0).toUpperCase() + str.slice(1);
        }
      },
       onlyUnique:function(value, index, self) {
        return self.indexOf(value) === index;
      },
      trim_whitespace: function(str){
        if(str && typeof str=="string"){
          str=str.replace(/^\s\s*/, '')
          str=str.replace(/\s\s*$/, '')
          str=str.replace(/  /, ' ')
          str=str.replace(/\s, /,', ')
          return str
        }
      }
    }

    //grab an array of internal links in the text
    function fetch_links(str){
      var links=[]
      var tmp=str.match(/\[\[(.{2,80}?)\]\](\w{0,10})/g)//regular links
      if(tmp){
          tmp.forEach(function(s){
              var link, txt;
              if(s.match(/\|/)){  //replacement link [[link|text]]
                s=s.replace(/\[\[(.{2,80}?)\]\](\w{0,10})/g,"$1$2") //remove ['s and keep suffix
                link=s.replace(/(.{2,60})\|.{0,200}/,"$1")//replaced links
                txt=s.replace(/.{2,60}?\|/,'')
                //handle funky case of [[toronto|]]
                if(!txt && link.match(/\|$/)){
                  link=link.replace(/\|$/,'')
                  txt=link
                }
              }else{ // standard link [[link]]
                link=s.replace(/\[\[(.{2,60}?)\]\](\w{0,10})/g,"$1") //remove ['s
              }
              //kill off non-wikipedia namespaces
              if(link.match(/^:?(category|image|file|media|special|wp|wikipedia|help|user|mediawiki|portal|talk|template|book|draft|module|topic|wiktionary|wikisource):/i)){
                  return
              }
              //kill off just anchor links [[#history]]
              if(link.match(/^#/i)){
                  return
              }
              //remove anchors from end [[toronto#history]]
              link=link.replace(/#[^ ]{1,100}/,'')
              link=helpers.capitalise(link)
              var obj={
                page:link,
                src: txt
              }
              links.push(obj)
          })
      }
      links=links.filter(helpers.onlyUnique)
      if(links.length==0){
        return undefined
      }
      return links
    }
    // console.log(fetch_links("it is [[Tony Hawk|Tony]]s moher in [[Toronto]]s"))

    function fetch_categories(wiki){
      var cats=[]
      var tmp=wiki.match(/\[\[:?category:(.{2,60}?)\]\](\w{0,10})/gi)//regular links
      if(tmp){
          tmp.forEach(function(c){
            c=c.replace(/^\[\[:?category:/i,'')
            c=c.replace(/\|?[ \*]?\]\]$/i,'')
            if(c && !c.match(/[\[\]]/)){
              cats.push(c)
            }
          })
        }
      return cats
    }

    //return only rendered text of wiki links
    function resolve_links(line){
        // categories, images, files
        var re= /\[\[:?Category:[^\[\]]{2,80}\]\]/g
        line=line.replace(re, "")

        // [[Common links]]
        line=line.replace(/\[\[:?([^|]{2,80}?)\]\](\w{0,5})/g, "$1$2")
        // [[Replaced|Links]]
        line=line.replace(/\[\[:?(.{2,80}?)\|([^\]]+?)\]\](\w{0,5})/g, "$2$3")
        // External links
        line=line.replace(/\[(https?|news|ftp|mailto|gopher|irc):\/\/[^ ]{4,1500}\]/g, "")
        return line
    }

    function parse_image(img){
      img= img.match(/(file|image):.*?[\|\]]/i) || ['']
      img=img[0].replace(/\|$/,'')
      return img
    }

    function parse_infobox(str){
        var obj={}
        // var str= str.match(/\{\{Infobox [\s\S]*?\}\}/i)
        if(str ){
          //this collapsible list stuff is just a headache
          str=str.replace(/\{\{Collapsible list[^\}]{10,1000}\}\}/g,'')
          str.replace(/\r/g,'').split(/\n/).forEach(function(l){
              if(l.match(/^\|/)){
                  var key= l.match(/^\| ?([^ ]{1,200}) /) || {}
                  key= helpers.trim_whitespace(key[1] || '')
                  var value= l.match(/=(.{1,500})$/) || []
                  value=helpers.trim_whitespace(value[1] || '')
                  if(key && value){
                    obj[key]=parse_line(value)
                    //turn number strings into integers
                    if(obj[key].text.match(/^[0-9,]*$/)){
                      obj[key].text= obj[key].text.replace(/,/g)
                      obj[key].text= parseInt(obj[key].text)
                    }
                }
              }
          })
        }
        return obj
    }

    function preprocess(wiki){
      //remove comments
      wiki= wiki.replace(/<!--[^>]{0,2000}-->/g,'')
      wiki=wiki.replace(/__(NOTOC|NOEDITSECTION|FORCETOC|TOC)__/ig,'')
      //signitures
      wiki=wiki.replace(/~~{1,3}/,'')
      //horizontal rule
      wiki=wiki.replace(/--{1,3}/,'')
      //space
      wiki=wiki.replace(/&nbsp;/g,' ')
      //kill off interwiki links
      wiki=wiki.replace(/\[\[([a-z][a-z]|simple|war|ceb|min):.{2,60}\]\]/i,'')
      //bold/italics
      wiki=wiki.replace(/''{0,3}([^']{0,200})''{0,3}/g,'$1')
      //give it the inglorious send-off it deserves..
      wiki=kill_xml(wiki)

      //remove tables
      wiki= wiki.replace(/\{\|[\s\S]{1,8000}?\|\}/g,'')


      return wiki
    }
    // console.log(preprocess("hi [[as:Plancton]] there"))
    // console.log(preprocess("hi [[as:Plancton]] there"))
      // console.log(preprocess('hello <br/> world'))
      // console.log(preprocess("hello <asd f> world </h2>"))


    function parse_line(line){
      return {
        text:postprocess(line),
        links:fetch_links(line)
      }
    }

    function postprocess(line){

        //fix links
        line= resolve_links(line)
        //oops, recursive image bug
        if(line.match(/^(thumb|right|left)\|/i)){
            return
        }
        //some IPA pronounciations leave blank junk parenteses
        line=line.replace(/\([^a-z]{0,8}\)/,'')
        line=helpers.trim_whitespace(line)

        return line
    }

    function parse_redirect(wiki){
      return wiki.match(/#redirect \[\[(.{2,60}?)\]\]/i)[1]
    }

    //some xml elements are just junk, and demand full inglorious death by regular exp
    //other xml elements, like <em>, are plucked out afterwards
    function kill_xml(wiki){
      //https://en.wikipedia.org/wiki/Help:HTML_in_wikitext
      //luckily, refs can't be recursive..
      wiki=wiki.replace(/<ref>[\s\S]{0,500}?<\/ref>/gi,' ')// <ref></ref>
      wiki=wiki.replace(/<ref [^>]{0,200}?\/>/gi,' ')// <ref name=""/>
      wiki=wiki.replace(/<ref [^>]{0,200}?>[\s\S]{0,500}?<\/ref>/ig,' ')// <ref name=""></ref>
      //other types of xml that we want to trash completely
      wiki=wiki.replace(/<(table|code|dl|hiero|math|score|data) ?[^>]{0,200}?>[\s\S]{0,500}<\/(table|code|dl|hiero|math|score|data)>/gi,' ')// <table name=""><tr>hi</tr></table>

      //some xml-like fragments we can also kill
      //
      wiki=wiki.replace(/< ?(ref|span|div|table|data) [a-z0-9=" ]{2,20}\/ ?>/g, " ")//<ref name="asd"/>
      //some formatting xml, we'll keep their insides though
      wiki=wiki.replace(/<[ \/]?(p|sub|sup|span|nowiki|div|table|br|tr|td|th|pre|pre2|hr)[ \/]?>/g, " ")//<sub>, </sub>
      wiki=wiki.replace(/<[ \/]?(abbr|bdi|bdo|blockquote|cite|del|dfn|em|i|ins|kbd|mark|q|s)[ \/]?>/g, " ")//<abbr>, </abbr>
      wiki=wiki.replace(/<[ \/]?h[0-9][ \/]?>/g, " ")//<h2>, </h2>
      //a more generic + dangerous xml-tag removal
      wiki=wiki.replace(/<[ \/]?[a-z0-9]{1,8}[ \/]?>/g, " ")//<samp>

      return wiki
    }
    // console.log(kill_xml("hello <ref>nono!</ref> world1. hello <ref name='hullo'>nono!</ref> world2. hello <ref name='hullo'/>world3.  hello <table name=''><tr><td>hi<ref>nono!</ref></td></tr></table>world4. hello<ref name=''/> world5 <ref name=''>nono</ref>, man.}}"))
    // console.log(kill_xml("hello <table name=''><tr><td>hi<ref>nono!</ref></td></tr></table>world4"))
    // console.log(kill_xml('hello<ref name="theroyal"/> world <ref>nono</ref>, man}}'))
    // console.log(kill_xml('hello<ref name="theroyal"/> world5 <ref name="">nono</ref>, man'))
    // console.log(kill_xml("hello <asd f> world </h2>"))
    // console.log(kill_xml("North America,<ref name=\"fhwa\"> and one of"))

    // templates that need parsing and replacing for inline text
    //https://en.wikipedia.org/wiki/Category:Magic_word_templates
    var word_templates= function(wiki){
      //we can be sneaky with this template, as it's often found inside other templates
      wiki=wiki.replace(/\{\{URL\|([^ ]{4,100}?)\}\}/gi, "$1")
      //this one needs to be handled manually
      wiki=wiki.replace(/\{\{convert\|([0-9]*?)\|([^\|]*).*?\}\}/gi, "$1 $2")
      //date-time templates
      var d= new Date()
      wiki=wiki.replace(/\{\{(CURRENT|LOCAL)DAY(2)?\}\}/gi, d.getDate())
      var months=["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
      wiki=wiki.replace(/\{\{(CURRENT|LOCAL)MONTH(NAME|ABBREV)?\}\}/gi, months[d.getMonth()])
      wiki=wiki.replace(/\{\{(CURRENT|LOCAL)YEAR\}\}/gi, d.getFullYear())
      var days= [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
      wiki=wiki.replace(/\{\{(CURRENT|LOCAL)DAYNAME\}\}/gi, days[d.getDay()])
      //formatting templates
      wiki=wiki.replace(/\{\{(lc|uc|formatnum):(.*?)\}\}/gi, "$2")
      wiki=wiki.replace(/\{\{pull quote\|([\s\S]*?)(\|[\s\S]*?)?\}\}/gi, "$1")

      return wiki
    }
    // console.log(word_templates("hello {{CURRENTDAY}} world"))
    // console.log(word_templates("hello {{CURRENTMONTH}} world"))
    // console.log(word_templates("hello {{CURRENTYEAR}} world"))
    // console.log(word_templates("hello {{LOCALDAYNAME}} world"))
    // console.log(word_templates("hello {{lc:88}} world"))
    // console.log(word_templates("hello {{pull quote|Life is like\n|author=[[asdf]]}} world"))

    var wtf_wikipedia=function(wiki){
      var infobox=''
      var images=[]
      var categories=[];
      //detect if page is just redirect, and die
      if(wiki.match(/^#redirect \[\[.{2,60}?\]\]/i)){
        return {
          redirect:parse_redirect(wiki)
        }
      }
      //parse templates like {{currentday}}
      wiki= word_templates(wiki)

      //kill off th3 craziness
      wiki= preprocess(wiki)

      //reduce the scary recursive situations
      //remove {{template {{}} }} recursions
      var matches=recursive_matches( '{', '}', wiki)
      matches.forEach(function(s){
        if(s.match(/\{\{infobox /i) && !infobox){
          infobox= parse_infobox(s)
        }
        if(s.match(/\{\{(cite|infobox|sister|geographic|navboxes|listen)[ \|:\n]/i)){
          wiki=wiki.replace(s,'')
        }
      })
      //second, remove [[file:...[[]] ]] recursions
      matches=recursive_matches( '[', ']', wiki)
      matches.forEach(function(s){
        if(s.match(/\[\[(file|image)/i)){
          images.push(parse_image(s))
          wiki=wiki.replace(s,'')
        }
      })
      //now that the scary recursion issues are gone, we can trust simple regex methods

      //kill the rest of templates
      wiki=wiki.replace(/\{\{.*?\}\}/g,'')

      //get list of links, categories
      var cats=fetch_categories(wiki)
      var lines= wiki.replace(/\r/g,'').split(/\n/)

      //next, map each line into
      var output={}
      var section="Intro"
      lines.forEach(function(part){
        sentence_parser(part).forEach(function(line){
          if(!section){
              return
          }
          //ignore list
          if(line.match(/^[\*#:;\|]/)){
              return
          }
          //ignore only-punctuation
          if(!line.match(/[a-z0-9]/i)){
              return
          }
          //headings
          if(line.match(/^={1,5}[^=]{1,200}={1,5}$/)){
              section=line.match(/^={1,5}([^=]{2,200}?)={1,5}$/)[1] || ''
              //ban some sections
              if(section.match(/^(references|see also|external links|further reading)$/i)){
                  section=null
              }
              return
          }

          //still alive, add it to the section
          line=parse_line(line)
          if(line && line.text){
              if(!output[section]){
                  output[section]=[]
              }
              output[section].push(line)
          }
        })
      })

      //add additional image from infobox, if applicable
      if(infobox['image'] && infobox['image'].text){
        var img=infobox['image'].text || ''
        if(!img.match(/^(image|file)/i)){
          img="File:"+img
        }
        images.push(img)
      }

      return {
        text:output,
        data:{
          categories:cats,
          images:images
        },
        infobox:infobox
      }

    }

    if (typeof module !== 'undefined' && module.exports) {
      module.exports = wtf_wikipedia;
    }

    return wtf_wikipedia
})()


// var plaintext=function(data){
//   return Object.keys(data.text).map(function(k){
//     return data.text[k].map(function(a){
//       return a.text
//     }).join(" ")
//   })
// }

// function from_file(page){
//   fs=require("fs")
//   var str = fs.readFileSync(__dirname+"/tests/"+page+".txt", 'utf-8')
//   var data=wtf_wikipedia(str)
//   // data=plaintext(data)
//   console.log(JSON.stringify(data, null, 2));
// }

// function from_api(page){
//   var fetch=require("./fetch_text")
//   fetch(page, function(str){
//     console.log(parser(str).text['Intro'])
//   })
// }
// function run_tests(){
//   require("./tests/test")()
// }


// from_file("Toronto")
// from_file("Toronto_Star")
// from_file("Royal_Cinema")
// from_file("Jodie_Emery")
// var str="rter million acres (1000&nbsp;km<sup>2</sup>) of land "
// var str= "having 1,800 buildings over {{convert|30|m|ft}}.<ref>{{cite web|url=http://skyscraperpage.com/diagrams|title=skyscraperpage.com/diagrams Most of these buildings are residential, whereas the central business district contains commercial office towers. There has been recent attention given for the need to retrofit many of these buildings, which were constructed beginning in the 1950s as residential apartment blocks to accommodate a quickly growing population. As of November 2011, the city had 132 high-rise buildings under construction.|url=http://www.thestar.com/news/article/1064773-highrises-we-re-tops-on-the-continent|publisher=Skyscraperpage.com |accessdate=April 18, 2014}}</ref>"
// str="hello <h2> world </h2>"
// str="hello <asd f> world </h2>"
// str="North America,<ref name=\"fhwa\"> and one of"
// var data=parser(str)
// console.log(data.text.Intro[0])
// wiki="{{convert|2|km|mi}}"




//  TODO:
//  [[St. Kitts]] sentence bug
//  parse [[image: ..]]  and make href
//  console.log(kill_xml("North America,<ref name=\"fhwa\"> and one of"))
// ... sentence
// "latd=43"
